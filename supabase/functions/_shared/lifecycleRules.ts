// Regras de envio dos avisos de ciclo de vida (código puro, testado em
// src/test/lifecycleEmails.test.ts). Um aviso agendado só sai se a situação
// da pessoa ainda pede aquele aviso no momento do envio.
import {
  isAutoRenewMethod, type LifecycleContext, type LifecycleTemplate, RELATIONSHIP_TEMPLATES,
} from "./lifecycleTemplates.ts";
import { isSubscriptionPlan, TYPICAL_DECK_CREDITS } from "./plans.ts";

export interface RuleContext extends LifecycleContext {
  /** Último alerta de cobrança (billing_profiles.billing_alert). */
  billingAlert: string | null;
  /** Momento da última compra reconhecida (avulso, assinatura ou renovação). */
  lastPurchaseAt: string | null;
  /** Pix ou boleto em aberto, com o pedido. */
  pendingOrderId?: string | null;
  relationshipAllowed: boolean;
  internal: boolean;
}

export const isSubscriptionCurrent = (
  ctx: Pick<LifecycleContext, "plan" | "subscriptionStatus" | "renewsAt">,
  now: Date = new Date(),
): boolean => {
  if (!isSubscriptionPlan(ctx.plan)) return false;
  const renews = ctx.renewsAt ? new Date(ctx.renewsAt) : null;
  const status = ctx.subscriptionStatus ?? "active";
  if (status === "active" || status === "trialing") return !renews || renews > now;
  if (status === "canceled") return !!renews && renews > now;
  return false;
};

/** Data da próxima cobrança considerada nos lembretes (mesma regra do planejador SQL). */
export const dueDate = (ctx: Pick<LifecycleContext, "autoRenew" | "nextPaymentDate" | "renewsAt">): string | null =>
  ctx.autoRenew && ctx.nextPaymentDate ? ctx.nextPaymentDate : ctx.renewsAt;

const spDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export type Decision = { send: boolean; reason?: string };

/**
 * Reavalia um aviso no momento do envio.
 * `scheduledAt` = quando o aviso foi agendado (para "comprou depois disso?").
 */
export const shouldSend = (
  template: LifecycleTemplate,
  ctx: RuleContext,
  data: Record<string, unknown>,
  scheduledAt: string,
  now: Date = new Date(),
): Decision => {
  if (!ctx.email) return { send: false, reason: "no_email" };
  if (RELATIONSHIP_TEMPLATES.includes(template)) {
    if (ctx.internal) return { send: false, reason: "internal_account" };
    if (!ctx.relationshipAllowed) return { send: false, reason: "unsubscribed" };
  }
  const purchasedSince = !!ctx.lastPurchaseAt && new Date(ctx.lastPurchaseAt) >= new Date(scheduledAt);

  switch (template) {
    case "nurture":
      return ctx.hasPurchased ? { send: false, reason: "purchased" } : { send: true };
    case "checkout_abandoned":
      return purchasedSince ? { send: false, reason: "purchased" } : { send: true };
    case "pix_pending":
    case "boleto_pending": {
      if (purchasedSince) return { send: false, reason: "purchased" };
      if (!ctx.pending || (data.order_id && ctx.pendingOrderId !== data.order_id)) return { send: false, reason: "not_pending" };
      if (ctx.pending.expiresAt && new Date(ctx.pending.expiresAt) <= now) return { send: false, reason: "expired" };
      return { send: true };
    }
    case "renewal_reminder": {
      if (!isSubscriptionCurrent(ctx, now)) return { send: false, reason: "not_current" };
      const due = dueDate(ctx);
      if (!due || (typeof data.due === "string" && spDay(due) !== spDay(data.due))) return { send: false, reason: "due_changed" };
      return { send: true };
    }
    case "subscription_late_followup":
      return ctx.billingAlert === "late" ? { send: true } : { send: false, reason: "resolved" };
    case "winback":
      return isSubscriptionCurrent(ctx, now) ? { send: false, reason: "resubscribed" } : { send: true };
    case "credits_low":
      return ctx.balance < TYPICAL_DECK_CREDITS ? { send: true } : { send: false, reason: "balance_ok" };
    default:
      return { send: true };
  }
};

/** Horário de envio dos e-mails de relacionamento: 9 h às 20 h (Brasília). */
export const nextAllowedTime = (now: Date = new Date()): Date | null => {
  const hour = Number(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false })) % 24;
  if (hour >= 9 && hour < 20) return null;
  // Próximas 9 h de Brasília (UTC−3, sem horário de verão desde 2019).
  const d = new Date(now.getTime());
  const spNow = new Date(d.getTime() - 3 * 3600_000);
  const target = new Date(Date.UTC(spNow.getUTCFullYear(), spNow.getUTCMonth(), spNow.getUTCDate(), 12, 0, 0));
  if (hour >= 20) target.setUTCDate(target.getUTCDate() + 1);
  return target;
};

/** Limite de frequência dos e-mails de relacionamento: 1 por dia e 3 por semana. */
export const frequencyDelay = (sentLast24h: number, sentLast7d: number): number | null => {
  if (sentLast24h >= 1) return 24;
  if (sentLast7d >= 3) return 48;
  return null;
};

export { isAutoRenewMethod };
