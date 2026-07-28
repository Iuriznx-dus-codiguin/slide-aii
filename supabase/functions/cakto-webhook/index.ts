// Cakto webhook receiver — atualiza profiles.plan/subscription_status após eventos de pagamento.
//
// Suporta os eventos oficiais da Cakto:
//   • purchase_approved       → libera geração única (single) ou ativa assinatura no primeiro ciclo
//   • subscription_created    → ativa assinatura
//   • subscription_renewed    → estende o período (renewsAt = agora + ciclo)
//   • subscription_canceled   → marca status=canceled (o entitlement bloqueia geração)
//   • refunded / chargeback   → cancela e limpa o plano
//
// Segurança:
//   • O segredo do webhook pode chegar em três lugares: header `x-cakto-token`
//     (recomendado), query param `?token=` OU campo `secret` no corpo do JSON
//     (formato oficial da Cakto). Sem `CAKTO_WEBHOOK_SECRET` configurado, o
//     endpoint recusa todos os payloads (fail-closed).
//   • Idempotência real via índice único parcial em `payment_events.cakto_id`.
//
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-token, x-signature",
};

type Plan =
  | "single"
  | "mensal" | "trimestral" | "anual"
  | "max_mensal" | "max_trimestral" | "max_anual";

// Mapeamento por short_id do checkout Cakto → plano interno. Se um novo
// checkout for provisionado, basta adicionar a linha aqui.
const PLAN_BY_CHECKOUT_ID: Record<string, Plan> = {
  // PRO / geração única
  qw6rzxx_856330: "single",
  yw7ej87_856334: "mensal",
  dvbmjwr:        "trimestral",
  m6z7n3k_856339: "anual",
  // MAX
  "8hk6vba_996784": "max_mensal",
  aubz6ai:          "max_trimestral",
  "57bwznr_996791": "max_anual",
};

// Fallback por product_id (raro; Cakto normalmente entrega short_id).
const PLAN_BY_PRODUCT_ID: Record<string, Plan> = {
  "856330": "single",
  "856334": "mensal",
  "856339": "anual",
  "996784": "max_mensal",
  "996791": "max_anual",
};

const dig = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const v = p.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const normalizeSecret = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^Bearer\s+/i, "")
    .replace(/^Token\s+/i, "")
    .replace(/^Secret\s+/i, "")
    .trim();
};

const hasValidSecret = (providedValues: Array<string | null>, expected: string): boolean => {
  const normalizedExpected = normalizeSecret(expected);
  if (!normalizedExpected) return false;

  return providedValues.some((value) => normalizeSecret(value) === normalizedExpected);
};

/** Adiciona `months` meses a uma data preservando o dia (com clamp no fim do mês). */
const addMonths = (d: Date, months: number): Date => {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setMonth(r.getMonth() + months);
  if (r.getDate() < day) r.setDate(0); // último dia do mês anterior (fev/30 → fev/28)
  return r;
};

const cyclePeriodMonths = (plan: Plan): number | null => {
  if (plan === "mensal" || plan === "max_mensal") return 1;
  if (plan === "trimestral" || plan === "max_trimestral") return 3;
  if (plan === "anual" || plan === "max_anual") return 12;
  return null; // single não renova
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE);

  if (!WEBHOOK_SECRET) {
    console.error("cakto-webhook: CAKTO_WEBHOOK_SECRET not configured — refusing all webhooks.");
    return new Response(
      JSON.stringify({ error: "Webhook not configured." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Lê o corpo UMA vez — o secret pode vir no body (formato Cakto) ou no header.
  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const providedValues = [
    req.headers.get("x-cakto-token"),
    req.headers.get("x-cakto-secret"),
    req.headers.get("x-webhook-secret"),
    req.headers.get("x-signature"),
    req.headers.get("authorization"),
    new URL(req.url).searchParams.get("token"),
    new URL(req.url).searchParams.get("secret"),
    typeof payload?.secret === "string" ? payload.secret : null,
    typeof payload?.data?.secret === "string" ? payload.data.secret : null,
  ];

  if (!hasValidSecret(providedValues, WEBHOOK_SECRET)) {
    console.warn("cakto-webhook: invalid secret", {
      hasHeaderToken: !!req.headers.get("x-cakto-token"),
      hasHeaderSecret: !!req.headers.get("x-cakto-secret") || !!req.headers.get("x-webhook-secret"),
      hasAuthorization: !!req.headers.get("authorization"),
      hasQuerySecret: !!new URL(req.url).searchParams.get("secret") || !!new URL(req.url).searchParams.get("token"),
      hasBodySecret: typeof payload?.secret === "string" || typeof payload?.data?.secret === "string",
    });
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event_type = String(dig(payload, ["event", "type", "data.event", "status"]) ?? "").toLowerCase();
  const cakto_id = dig(payload, ["data.id", "id", "data.transaction.id", "transaction_id"]);
  const email = (dig(payload, [
    "data.customer.email", "customer.email", "data.buyer.email",
    "buyer.email", "data.email", "email",
  ]) as string | undefined)?.toLowerCase();
  const checkoutSlug = dig(payload, [
    "data.product.short_id", "data.product.slug", "data.checkout.slug",
    "checkout.slug", "product.slug", "data.product.checkout_id",
  ]) as string | undefined;
  const productId = String(dig(payload, [
    "data.product.id", "product.id", "data.offer.id", "offer.id", "data.refId", "refId",
  ]) ?? "");
  const status = (dig(payload, [
    "data.status", "status", "data.transaction.status", "payment_status",
  ]) as string | undefined)?.toLowerCase();

  const checkoutUrl = dig(payload, ["data.checkoutUrl", "checkoutUrl", "data.checkout_url", "checkout_url"]) as string | undefined;
  const checkoutSlugFromUrl = checkoutUrl?.match(/pay\.cakto\.com\.br\/([^/?#]+)/i)?.[1];

  const plan: Plan | undefined =
    (checkoutSlug && PLAN_BY_CHECKOUT_ID[checkoutSlug])
    || (checkoutSlugFromUrl && PLAN_BY_CHECKOUT_ID[checkoutSlugFromUrl])
    || PLAN_BY_PRODUCT_ID[productId]
    || undefined;

  const customerId = dig(payload, ["data.customer.id", "customer.id"]) as string | undefined;
  const subscriptionId = dig(payload, ["data.subscription.id", "subscription.id"]) as string | undefined;

  // Resolve o user_id pelo e-mail.
  let userId: string | null = null;
  if (email) {
    const { data: profile } = await admin
      .from("profiles").select("id").eq("email", email).maybeSingle();
    if (profile?.id) {
      userId = profile.id;
    } else {
      try {
        const anyAdmin = admin.auth.admin as any;
        if (typeof anyAdmin.getUserByEmail === "function") {
          const { data: u } = await anyAdmin.getUserByEmail(email);
          if (u?.user?.id) userId = u.user.id;
        }
      } catch (_e) { /* ignore */ }
    }
  }

  // Idempotência atômica via índice único parcial em cakto_id.
  const { data: insertedEvent, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      provider: "cakto",
      event_type: event_type || "unknown",
      cakto_id: cakto_id ?? null,
      user_email: email ?? null,
      user_id: userId,
      payload,
      processed: false,
    })
    .select("id")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      console.info("cakto-webhook: duplicate delivery ignored", cakto_id);
      return new Response(JSON.stringify({ ok: true, note: "duplicate delivery ignored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("cakto-webhook: failed to record payment_event", insertErr);
    return new Response(JSON.stringify({ error: "Falha ao registrar evento de pagamento." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const eventRowId = insertedEvent!.id as string;

  // Classificação de eventos.
  const PAID_HINTS = [
    "purchase_approved", "subscription_created", "subscription_renewed",
    "approved", "paid", "completed", "success", "active", "renewed",
  ];
  const CANCEL_HINTS = ["subscription_canceled", "canceled", "cancelled"];
  const REFUND_HINTS = ["refunded", "refund", "chargeback", "chargedback"];

  const eventOrStatus = `${event_type} ${status ?? ""}`;
  const matchesPaid     = PAID_HINTS.some((h) => eventOrStatus.includes(h));
  const matchesCanceled = CANCEL_HINTS.some((h) => eventOrStatus.includes(h));
  const matchesRefund   = REFUND_HINTS.some((h) => eventOrStatus.includes(h));

  if (!userId) {
    console.warn("cakto-webhook: user not found", { email, event_type });
    await admin.from("payment_events")
      .update({ processed: true, error_message: "user not found by email" })
      .eq("id", eventRowId);
    return new Response(JSON.stringify({ ok: true, note: "user not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (matchesPaid && plan) {
      const now = new Date();
      const periodMonths = cyclePeriodMonths(plan);
      const renewsAt = periodMonths ? addMonths(now, periodMonths) : null;

      const patch: Record<string, unknown> = {
        plan,
        subscription_status: "active",
        subscription_period_start: now.toISOString(),
        cakto_customer_id: customerId ?? null,
        cakto_subscription_id: subscriptionId ?? null,
      };
      if (renewsAt) patch.subscription_renews_at = renewsAt.toISOString();

      await admin.from("profiles").update(patch).eq("id", userId);

      if (plan === "single") {
        const { error: creditErr } = await admin.rpc("grant_single_credit", { _uid: userId });
        if (creditErr) console.error("cakto-webhook: grant_single_credit failed", creditErr);
      }
    } else if (matchesRefund) {
      // Reembolso ou chargeback: cancela e limpa o plano.
      await admin.from("profiles").update({
        subscription_status: "canceled",
        plan: "free",
      }).eq("id", userId);
    } else if (matchesCanceled) {
      // Cancelamento profissional: NÃO apaga o plano; apenas marca como
      // canceled. O useEntitlement bloqueia a geração e mostra a mensagem
      // "Sua assinatura foi cancelada…". Mantém o registro do plano para
      // eventual reativação e para exibir corretamente na conta.
      await admin.from("profiles").update({
        subscription_status: "canceled",
      }).eq("id", userId);
    } else {
      console.info("cakto-webhook: event ignored", { event_type, status });
    }

    await admin.from("payment_events").update({ processed: true }).eq("id", eventRowId);
  } catch (e) {
    console.error("cakto-webhook process error", e);
    await admin.from("payment_events").update({
      error_message: e instanceof Error ? e.message : String(e),
    }).eq("id", eventRowId);
  }

  return new Response(JSON.stringify({ ok: true, event: event_type, plan, userId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
