// Regra de acesso à geração — espelho, em TypeScript, de
// `public.can_user_generate` (migração 0003_legal_compliance).
//
// As duas precisam decidir igual: o banco é quem autoriza e cobra; esta
// versão só alimenta a interface (saldo, avisos, botão de gerar). Os testes
// em src/test/entitlement.test.ts fixam os cenários.
//
// Regras que refletem os Termos de Uso:
// • Cancelar a assinatura NÃO corta o acesso na hora: o período já pago vale
//   até `subscription_renews_at` (Termos, "Cancelamento").
// • O bônus (créditos avulsos e bônus de ativação) é permanente: continua
//   utilizável depois que a assinatura termina (Termos, "Créditos").
// • O plano MAX é de uso ilimitado dentro da Política de Uso Justo; ao atingir
//   o teto do ciclo, o motivo é `fair_use_limit` — nunca um erro técnico falso.
import { PLAN_MONTHLY_CREDITS, isMaxPlan, isMonthlyCycleDue, isSubscriptionPlan } from "@/lib/cakto";

export type EntitlementReason =
  | "dev"
  | "single"
  | "subscription"
  | "bonus_only"
  | "no_plan"
  | "insufficient_credits"
  | "fair_use_limit"
  | "subscription_canceled"
  | "subscription_expired"
  | "system_error"
  | "loading";

export interface BillingProfile {
  plan?: string | null;
  credits_bonus?: number | null;
  credits_monthly?: number | null;
  credits_cycle_anchor?: string | null;
  subscription_status?: string | null;
  subscription_renews_at?: string | null;
}

export interface EntitlementDecision {
  allowed: boolean;
  reason: EntitlementReason;
  /** Bônus permanente (avulsos + bônus de ativação). */
  credits_bonus: number;
  /** Cota mensal utilizável agora (0 quando a assinatura não está vigente). */
  credits_monthly: number;
  credits_available: number;
  /** Cota mensal do plano vigente (0 para avulso, sem plano ou assinatura encerrada). */
  monthly_allowance: number;
  /** Assinatura PRO/MAX dentro do período pago (ativa ou cancelada até o fim). */
  subscription_current: boolean;
  /** MAX vigente: a interface não mostra custo (uso justo). */
  unlimited: boolean;
  /** Assinatura cancelada que continua valendo até esta data (ISO). */
  access_until: string | null;
}

const toTime = (iso: string | null | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/**
 * Assinatura que ainda dá direito à cota do plano — igual a
 * `public.subscription_is_current` no banco.
 *
 * Ativa (ou sem status, legado): vale enquanto a renovação não passou.
 * Cancelada: vale até o fim do período pago, e só se esse fim é conhecido.
 * Qualquer outro status (inadimplente etc.): não vale.
 */
export const isSubscriptionCurrent = (profile: BillingProfile | null | undefined, now: Date = new Date()): boolean => {
  if (!profile || !isSubscriptionPlan(profile.plan)) return false;
  const status = profile.subscription_status ?? null;
  const renews = toTime(profile.subscription_renews_at);
  const periodOpen = renews === null || renews > now.getTime();
  if (status === null || status === "active" || status === "trialing") return periodOpen;
  if (status === "canceled") return renews !== null && renews > now.getTime();
  return false;
};

interface DecideOptions {
  /** Custo da operação em créditos. A interface usa 1 ("ter algum saldo"). */
  cost?: number;
  now?: Date;
  isDeveloper?: boolean;
}

export const decideEntitlement = (
  profile: BillingProfile | null | undefined,
  { cost = 0, now = new Date(), isDeveloper = false }: DecideOptions = {},
): EntitlementDecision => {
  const plan = profile?.plan ?? "free";
  const bonus = Math.max(0, profile?.credits_bonus ?? 0);
  const storedMonthly = Math.max(0, profile?.credits_monthly ?? 0);
  const allowance = PLAN_MONTHLY_CREDITS[plan] ?? 0;
  const isSub = isSubscriptionPlan(plan);
  const current = isSubscriptionCurrent(profile, now);
  const need = Math.max(0, cost);

  const base = (over: Partial<EntitlementDecision>): EntitlementDecision => ({
    allowed: false,
    reason: "no_plan",
    credits_bonus: bonus,
    credits_monthly: 0,
    credits_available: bonus,
    // Sem assinatura vigente não há cota mensal (mesmo que o plano ainda
    // conste no perfil até o próximo pagamento).
    monthly_allowance: 0,
    subscription_current: false,
    unlimited: false,
    access_until: null,
    ...over,
  });

  if (isSub && current) {
    // Renovação preguiçosa: o banco só grava a nova cota no próximo débito.
    const monthly = allowance > 0 && isMonthlyCycleDue(profile?.credits_cycle_anchor, now) ? allowance : storedMonthly;
    const available = bonus + monthly;
    const accessUntil = profile?.subscription_status === "canceled" ? profile?.subscription_renews_at ?? null : null;
    const common = {
      credits_monthly: monthly,
      credits_available: available,
      monthly_allowance: allowance,
      subscription_current: true,
      unlimited: isMaxPlan(plan),
      access_until: accessUntil,
    };
    if (isDeveloper) return base({ ...common, allowed: true, reason: "dev" });
    if (available >= need) return base({ ...common, allowed: true, reason: "subscription" });
    return base({ ...common, reason: isMaxPlan(plan) ? "fair_use_limit" : "insufficient_credits" });
  }

  if (plan === "single") {
    const available = bonus + storedMonthly;
    const common = { credits_monthly: storedMonthly, credits_available: available };
    if (isDeveloper) return base({ ...common, allowed: true, reason: "dev" });
    if (available >= need) return base({ ...common, allowed: true, reason: "single" });
    return base({ ...common, reason: "insufficient_credits" });
  }

  if (isDeveloper) return base({ allowed: true, reason: "dev" });

  // Sem assinatura vigente: o bônus permanente continua valendo.
  if (bonus > 0 && bonus >= need) return base({ allowed: true, reason: "bonus_only" });
  if (isSub) {
    return base({ reason: profile?.subscription_status === "canceled" ? "subscription_canceled" : "subscription_expired" });
  }
  if (bonus > 0) return base({ reason: "insufficient_credits" });
  return base({ reason: "no_plan" });
};

/** Data (dd/mm/aaaa) em que a cota mensal renova, a partir da âncora do ciclo. */
export const nextMonthlyReset = (anchor: string | null | undefined): string | null => {
  if (!anchor) return null;
  const [y, m, d] = anchor.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  const lastDayNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const due = new Date(Date.UTC(y, m, Math.min(d, lastDayNext)));
  return due.toLocaleDateString("pt-BR", { timeZone: "UTC" });
};
