// Avisos de ciclo de vida: monta a situação da pessoa, envia na hora ou agenda.
// Modelos: ./lifecycleTemplates.ts · Regras: ./lifecycleRules.ts ·
// Plano: docs/produto/plano-de-avisos-por-email.md
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendRenderedEmail, type SendResult } from "./email.ts";
import { renderLayout, renderText, SITE_URL } from "./emailTemplates.ts";
import {
  buildLifecycleEmail, firstNameOf, isAutoRenewMethod, type LifecycleTemplate, normalizePersona, templateKind,
} from "./lifecycleTemplates.ts";
import { isSubscriptionCurrent, type RuleContext, shouldSend } from "./lifecycleRules.ts";

const PURCHASE_TYPES = ["single_purchase", "subscription_monthly", "subscription_renewal", "subscription_signup_bonus"];

/** Situação atual da conta, usada nos modelos e nas regras de envio. */
export const loadLifecycleContext = async (admin: SupabaseClient, userId: string): Promise<RuleContext | null> => {
  const [{ data: p }, { data: b }, { data: charge }, { data: lastPurchase }, { data: purchased }, { data: internal }, { data: token }] =
    await Promise.all([
      admin.from("profiles").select(
        "full_name, username, email, role, plan, subscription_status, subscription_renews_at, credits_bonus, credits_monthly, generations_count",
      ).eq("id", userId).maybeSingle(),
      admin.from("billing_profiles").select("*").eq("user_id", userId).maybeSingle(),
      admin.from("pending_charges").select("kind, order_id, pay_url, pix_code, amount, expires_at")
        .eq("user_id", userId).is("resolved_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("credit_transactions").select("created_at").eq("user_id", userId).in("type", PURCHASE_TYPES)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.rpc("user_has_purchased", { _uid: userId }),
      admin.rpc("is_internal_account", { _uid: userId }),
      admin.rpc("ensure_email_preferences", { _uid: userId }),
    ]);
  if (!p) return null;

  let email = (p.email ?? "").trim();
  if (!email) {
    const { data: u } = await admin.auth.admin.getUserById(userId);
    email = u?.user?.email ?? "";
  }
  const { data: prefs } = await admin.from("email_preferences").select("relationship_emails").eq("user_id", userId).maybeSingle();

  const base = {
    plan: p.plan ?? null,
    subscriptionStatus: p.subscription_status ?? null,
    renewsAt: p.subscription_renews_at ?? null,
  };
  const current = isSubscriptionCurrent(base);
  const tokenStr = typeof token === "string" ? token : null;
  const prefsPage = tokenStr ? `${SITE_URL}/emails/preferencias?t=${tokenStr}` : undefined;

  return {
    ...base,
    firstName: firstNameOf(p.full_name, p.username),
    persona: normalizePersona(p.role),
    email,
    autoRenew: b?.auto_renew ?? isAutoRenewMethod(b?.payment_method),
    paymentMethod: b?.payment_method ?? null,
    cardBrand: b?.card_brand ?? null,
    cardLast4: b?.card_last4 ?? null,
    nextPaymentDate: b?.next_payment_date ?? null,
    balance: (p.credits_bonus ?? 0) + (current ? Math.max(p.credits_monthly ?? 0, 0) : 0),
    hasPurchased: purchased === true,
    generations: p.generations_count ?? 0,
    pending: charge
      ? { kind: charge.kind, url: charge.pay_url, code: charge.pix_code, expiresAt: charge.expires_at, amount: charge.amount }
      : null,
    pendingOrderId: charge?.order_id ?? null,
    billingAlert: b?.billing_alert ?? null,
    lastPurchaseAt: lastPurchase?.created_at ?? null,
    relationshipAllowed: prefs?.relationship_emails !== false,
    internal: internal === true,
    preferencesUrl: prefsPage,
    unsubscribeUrl: prefsPage ? `${prefsPage}&sair=1` : undefined,
  };
};

/** Cabeçalhos de descadastro em um clique (RFC 8058), exigidos por Gmail e Yahoo. */
const unsubscribeHeaders = (token: string): Record<string, string> => {
  const fn = `${Deno.env.get("SUPABASE_URL")}/functions/v1/email-unsubscribe?t=${token}`;
  return {
    "List-Unsubscribe": `<${fn}>, <mailto:suporte@slideai.com.br?subject=descadastrar>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
};

/** Monta e envia um aviso para a situação atual da pessoa. */
export const sendLifecycle = async (
  admin: SupabaseClient,
  opts: { userId: string; template: LifecycleTemplate; dedupeKey: string; data?: Record<string, unknown>; ctx?: RuleContext },
): Promise<SendResult | `skipped:${string}`> => {
  try {
    const ctx = opts.ctx ?? await loadLifecycleContext(admin, opts.userId);
    if (!ctx) return "skipped:no_profile";
    if (!ctx.email) return "skipped:no_email";
    const kind = templateKind(opts.template);
    if (kind === "relationship" && (!ctx.relationshipAllowed || ctx.internal)) {
      return ctx.internal ? "skipped:internal_account" : "skipped:unsubscribed";
    }
    const c = buildLifecycleEmail(opts.template, ctx, opts.data ?? {});
    const token = ctx.preferencesUrl ? new URL(ctx.preferencesUrl).searchParams.get("t") : null;
    return await sendRenderedEmail(admin, {
      to: ctx.email,
      userId: opts.userId,
      dedupeKey: opts.dedupeKey,
      event: opts.template,
      subject: c.subject,
      html: renderLayout(c),
      text: renderText(c),
      from: c.from,
      headers: kind === "relationship" && token ? unsubscribeHeaders(token) : undefined,
    });
  } catch (e) {
    console.error("lifecycle_send_failed", opts.template, e instanceof Error ? e.message : String(e));
    return "failed";
  }
};

/** Agenda um aviso (idempotente pela chave). Nunca lança. */
export const scheduleLifecycle = async (
  admin: SupabaseClient,
  opts: { userId: string; template: LifecycleTemplate; sendAt: Date; dedupeKey: string; data?: Record<string, unknown> },
): Promise<void> => {
  const { error } = await admin.from("email_schedule").insert({
    user_id: opts.userId, template: opts.template, send_at: opts.sendAt.toISOString(),
    dedupe_key: opts.dedupeKey, data: opts.data ?? {},
  });
  if (error && error.code !== "23505") console.error("lifecycle_schedule_failed", opts.template, error.message);
};

/** Reavalia e envia um aviso agendado. Usado pelo email-dispatcher. */
export const decideAndSend = async (
  admin: SupabaseClient,
  row: { user_id: string; template: string; data: Record<string, unknown>; dedupe_key: string; created_at: string },
): Promise<{ status: "sent" | "skipped" | "failed"; reason?: string }> => {
  const ctx = await loadLifecycleContext(admin, row.user_id);
  if (!ctx) return { status: "skipped", reason: "no_profile" };
  const template = row.template as LifecycleTemplate;
  const d = shouldSend(template, ctx, row.data ?? {}, row.created_at);
  if (!d.send) return { status: "skipped", reason: d.reason };
  const r = await sendLifecycle(admin, { userId: row.user_id, template, dedupeKey: row.dedupe_key, data: row.data, ctx });
  if (r === "sent") return { status: "sent" };
  if (r === "duplicate") return { status: "skipped", reason: "duplicate" };
  if (r.startsWith("skipped:")) return { status: "skipped", reason: r.slice(8) };
  return { status: "failed", reason: r };
};
