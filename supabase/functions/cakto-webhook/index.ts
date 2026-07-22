// Cakto webhook receiver — atualiza profiles.plan e single_credits após pagamento.
// Verificação de segredo OBRIGATÓRIA, busca de usuário O(1) e idempotência por cakto_id.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-token, x-signature",
};

type Plan = "single" | "mensal" | "anual" | "max_mensal" | "max_anual";

// Mapeamento por slug/short_id do checkout Cakto. Os slugs do plano MAX ainda
// não foram provisionados; quando o Cakto emitir os checkouts, é só adicionar
// aqui os short_ids/product_ids correspondentes.
const PLAN_BY_CHECKOUT_ID: Record<string, Plan> = {
  qw6rzxx_856330: "single",
  yw7ej87_856334: "mensal",
  m6z7n3k_856339: "anual",
  // TODO: max_mensal e max_anual — adicionar quando Cakto liberar checkouts MAX
};
const PLAN_BY_PRODUCT_ID: Record<string, Plan> = {
  "856330": "single",
  "856334": "mensal",
  "856339": "anual",
};

const dig = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const v = p.split(".").reduce((a, k) => (a == null ? a : a[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE);

  // ─── Bloco 8.1: verificação OBRIGATÓRIA do segredo ───
  if (!WEBHOOK_SECRET) {
    console.error("cakto-webhook: CAKTO_WEBHOOK_SECRET not configured — refusing all webhooks.");
    return new Response(
      JSON.stringify({ error: "Webhook not configured. Set CAKTO_WEBHOOK_SECRET in edge function secrets." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const provided = req.headers.get("x-cakto-token")
    ?? req.headers.get("x-signature")
    ?? new URL(req.url).searchParams.get("token");
  if (provided !== WEBHOOK_SECRET) {
    console.warn("cakto-webhook: invalid secret");
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  const event_type = dig(payload, ["event", "type", "data.event", "status"]);
  const cakto_id = dig(payload, ["data.id", "id", "data.transaction.id", "transaction_id"]);
  const email = (dig(payload, [
    "data.customer.email", "customer.email", "data.buyer.email",
    "buyer.email", "data.email", "email",
  ]) as string | undefined)?.toLowerCase();
  const checkoutSlug = dig(payload, [
    "data.product.short_id", "data.product.slug", "data.checkout.slug",
    "checkout.slug", "product.slug",
  ]) as string | undefined;
  const productId = String(dig(payload, [
    "data.product.id", "product.id", "data.offer.id", "offer.id",
  ]) ?? "");
  const status = (dig(payload, [
    "data.status", "status", "data.transaction.status", "payment_status",
  ]) as string | undefined)?.toLowerCase();

  const plan: Plan | undefined =
    (checkoutSlug && PLAN_BY_CHECKOUT_ID[checkoutSlug])
    || PLAN_BY_PRODUCT_ID[productId]
    || undefined;

  const customerId = dig(payload, ["data.customer.id", "customer.id"]) as string | undefined;
  const subscriptionId = dig(payload, ["data.subscription.id", "subscription.id"]) as string | undefined;

  // ─── Bloco 8.2: busca direta do usuário (sem listUsers paginado) ───
  let userId: string | null = null;
  if (email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profile?.id) {
      userId = profile.id;
    } else {
      // Fallback eficiente: getUserByEmail via admin API quando disponível.
      try {
        const anyAdmin = admin.auth.admin as any;
        if (typeof anyAdmin.getUserByEmail === "function") {
          const { data: u } = await anyAdmin.getUserByEmail(email);
          if (u?.user?.id) userId = u.user.id;
        }
      } catch (_e) { /* ignore */ }
    }
  }

  // ─── Bloco 8.3: idempotência real via índice único parcial em cakto_id ───
  // O INSERT abaixo É a trava: se outra entrega concorrente do mesmo evento já
  // inseriu essa linha, o índice único (idx_payment_events_cakto_id_unique)
  // rejeita esta com erro 23505 (unique_violation) de forma atômica no banco —
  // diferente de um SELECT prévio, não existe janela onde duas requisições
  // simultâneas "não veem" a outra e ambas seguem para processar o pagamento.
  const { data: insertedEvent, error: insertErr } = await admin
    .from("payment_events")
    .insert({
      provider: "cakto",
      event_type: event_type ?? "unknown",
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

  const PAID_EVENTS = ["purchase_approved", "subscription_renewed", "subscription_created",
    "approved", "paid", "completed", "success", "active"];
  const CANCELED_EVENTS = ["subscription_canceled", "refunded", "chargeback", "canceled", "refund"];
  const matchesPaid = event_type && PAID_EVENTS.some((e) => String(event_type).toLowerCase().includes(e))
    || (status && PAID_EVENTS.includes(status));
  const matchesCanceled = event_type && CANCELED_EVENTS.some((e) => String(event_type).toLowerCase().includes(e));

  if (!userId) {
    console.warn("cakto-webhook: user not found", { email });
    return new Response(JSON.stringify({ ok: true, note: "user not found" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (matchesPaid && plan) {
      const now = new Date();
      const renewsAt = plan === "anual"
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
        : plan === "mensal"
          ? new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
          : null;

      const patch: any = {
        plan,
        subscription_status: "active",
        subscription_period_start: now.toISOString(),
        cakto_customer_id: customerId ?? null,
        cakto_subscription_id: subscriptionId ?? null,
      };
      if (renewsAt) patch.subscription_renews_at = renewsAt.toISOString();

      // profiles.update roda com a service role key, então passa direto pela
      // trigger protect_billing_columns (auth.role() = 'service_role').
      await admin.from("profiles").update(patch).eq("id", userId);

      if (plan === "single") {
        // Incremento atômico em uma única instrução — nunca lê o saldo antes
        // de gravar, então duas entregas concorrentes não perdem crédito.
        const { error: creditErr } = await admin.rpc("grant_single_credit", { _uid: userId });
        if (creditErr) console.error("cakto-webhook: grant_single_credit failed", creditErr);
      }
    } else if (matchesCanceled) {
      await admin.from("profiles").update({
        subscription_status: "canceled",
        plan: "free",
      }).eq("id", userId);
    }

    // Marca pelo id da própria linha inserida acima — robusto mesmo quando
    // cakto_id vem ausente/nulo no payload (antes, ".eq('cakto_id', cakto_id
    // ?? \"\")" nunca casava com uma coluna NULL e o evento ficava "processed:
    // false" para sempre nesses casos).
    await admin.from("payment_events").update({ processed: true }).eq("id", eventRowId);
  } catch (e) {
    console.error("cakto-webhook process error", e);
    await admin.from("payment_events").update({
      error_message: e instanceof Error ? e.message : String(e),
    }).eq("id", eventRowId);
  }

  return new Response(JSON.stringify({ ok: true, plan, userId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
