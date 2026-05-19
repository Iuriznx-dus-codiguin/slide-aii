// Cakto webhook receiver — atualiza profiles.plan e single_credits após pagamento.
// Aceita payloads "best-effort" (Cakto varia o shape entre produtos). Salva tudo
// em payment_events para auditoria.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cakto-token, x-signature",
};

// Mapeamento dos checkouts → plano interno
const PLAN_BY_CHECKOUT_ID: Record<string, "single" | "mensal" | "anual"> = {
  qw6rzxx_856330: "single",
  yw7ej87_856334: "mensal",
  m6z7n3k_856339: "anual",
};
// Também aceitamos pelo número do produto, caso o payload traga isso
const PLAN_BY_PRODUCT_ID: Record<string, "single" | "mensal" | "anual"> = {
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

  let payload: any = {};
  try { payload = await req.json(); } catch { payload = {}; }

  // Verificação de segredo (opcional — só se configurado)
  if (WEBHOOK_SECRET) {
    const provided = req.headers.get("x-cakto-token")
      ?? req.headers.get("x-signature")
      ?? new URL(req.url).searchParams.get("token");
    if (provided !== WEBHOOK_SECRET) {
      console.warn("cakto-webhook: invalid secret");
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

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

  const plan: "single" | "mensal" | "anual" | undefined =
    (checkoutSlug && PLAN_BY_CHECKOUT_ID[checkoutSlug])
    || PLAN_BY_PRODUCT_ID[productId]
    || undefined;

  const customerId = dig(payload, ["data.customer.id", "customer.id"]) as string | undefined;
  const subscriptionId = dig(payload, ["data.subscription.id", "subscription.id"]) as string | undefined;

  // Localiza usuário pelo email
  let userId: string | null = null;
  if (email) {
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (profile?.id) userId = profile.id;
    else {
      // fallback: procurar no auth.users via admin
      const { data: list } = await admin.auth.admin.listUsers();
      const u = list?.users?.find((x: any) => (x.email || "").toLowerCase() === email);
      if (u) userId = u.id;
    }
  }

  // Persiste evento
  await admin.from("payment_events").insert({
    provider: "cakto",
    event_type: event_type ?? "unknown",
    cakto_id: cakto_id ?? null,
    user_email: email ?? null,
    user_id: userId,
    payload,
    processed: false,
  });

  // Eventos considerados "ativadores"
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

      if (plan === "single") {
        const { data: cur } = await admin.from("profiles").select("single_credits").eq("id", userId).maybeSingle();
        patch.single_credits = (cur?.single_credits ?? 0) + 1;
      }
      await admin.from("profiles").update(patch).eq("id", userId);
    } else if (matchesCanceled) {
      await admin.from("profiles").update({
        subscription_status: "canceled",
        plan: "free",
      }).eq("id", userId);
    }

    await admin.from("payment_events").update({ processed: true })
      .eq("cakto_id", cakto_id ?? "")
      .eq("user_id", userId);
  } catch (e) {
    console.error("cakto-webhook process error", e);
    await admin.from("payment_events").update({
      error_message: e instanceof Error ? e.message : String(e),
    }).eq("user_id", userId).eq("cakto_id", cakto_id ?? "");
  }

  return new Response(JSON.stringify({ ok: true, plan, userId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
