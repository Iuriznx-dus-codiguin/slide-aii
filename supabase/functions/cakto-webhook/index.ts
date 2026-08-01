// Cakto webhook receiver — atualiza profiles.plan/subscription_status após eventos de pagamento.
//
// Eventos suportados:
//   • purchase_approved       → libera geração única (single) ou ativa assinatura no primeiro ciclo
//   • subscription_created    → ativa assinatura
//   • subscription_renewed    → estende o período (renewsAt = agora + ciclo)
//   • subscription_canceled   → marca status=canceled (o entitlement bloqueia geração)
//   • refunded / chargeback   → cancela e limpa o plano
//
// Segurança: o segredo pode chegar em header (`x-cakto-token`, `x-cakto-secret`,
// `authorization`…), query (`?token=`/`?secret=`) ou no corpo (`secret`).
// Sem `CAKTO_WEBHOOK_SECRET` configurado o endpoint recusa tudo (fail-closed).
// Idempotência via índice único parcial em `payment_events.cakto_id`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  addMonths, classifyEvent, collectProvidedSecrets, cyclePeriodMonths, dig,
  extractCaktoId, extractEmail, extractEventType, extractStatus, hasValidSecret, resolvePlan,
} from "./lib.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-token, x-cakto-secret, x-webhook-secret, x-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET");
  const admin = createClient(SUPABASE_URL, SERVICE);

  if (!WEBHOOK_SECRET) {
    console.error("cakto-webhook: CAKTO_WEBHOOK_SECRET not configured — refusing all webhooks.");
    return json({ error: "Webhook not configured." }, 500);
  }

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  if (!hasValidSecret(collectProvidedSecrets(req.headers, req.url, payload), WEBHOOK_SECRET)) {
    console.warn("cakto-webhook: invalid secret", {
      hasHeaderToken: !!req.headers.get("x-cakto-token"),
      hasAuthorization: !!req.headers.get("authorization"),
      hasBodySecret: typeof payload?.secret === "string",
    });
    return json({ error: "unauthorized" }, 401);
  }

  const event_type = extractEventType(payload);
  const status = extractStatus(payload);
  const cakto_id = extractCaktoId(payload);
  const email = extractEmail(payload);
  const plan = resolvePlan(payload);
  const action = classifyEvent(event_type, status);

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
      return json({ ok: true, note: "duplicate delivery ignored" });
    }
    console.error("cakto-webhook: failed to record payment_event", insertErr);
    return json({ error: "Falha ao registrar evento de pagamento." }, 500);
  }
  const eventRowId = insertedEvent!.id as string;

  if (!userId) {
    console.warn("cakto-webhook: user not found", { email, event_type });
    await admin.from("payment_events")
      .update({ processed: true, error_message: "user not found by email" })
      .eq("id", eventRowId);
    return json({ ok: true, note: "user not found" });
  }

  try {
    if (action === "paid" && plan) {
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
    } else if (action === "refund") {
      await admin.from("profiles").update({
        subscription_status: "canceled",
        plan: "free",
      }).eq("id", userId);
    } else if (action === "canceled") {
      // Não apaga o plano: apenas marca canceled. O entitlement bloqueia a geração
      // e a UI mostra "como renovar".
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

  return json({ ok: true, event: event_type, action, plan, userId });
});
