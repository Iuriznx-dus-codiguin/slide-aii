// Links de checkout Cakto e mapeamento de planos.
//
// Planos:
// - "single":         Geração única (R$ 14,90)
// - "mensal":         PRO Mensal      (R$ 49,90/mês)   — 3.200 créditos/mês
// - "trimestral":     PRO Trimestral  (R$ 127,90/3m)   — 3.200 créditos/mês  (~15% off)
// - "anual":          PRO Anual       (R$ 397,90/ano)  — 3.200 créditos/mês
// - "max_mensal":     MAX Mensal      (R$ 147,90/mês)  — ilimitado (16.000 créditos/mês)
// - "max_trimestral": MAX Trimestral  (R$ 377,90/3m)   — ilimitado (16.000 créditos/mês)
// - "max_anual":      MAX Anual       (R$ 1.175,00/ano) — ilimitado (16.000 créditos/mês)
export type PaidPlan =
  | "single"
  | "mensal" | "trimestral" | "anual"
  | "max_mensal" | "max_trimestral" | "max_anual";

export type BillingCycle = "mensal" | "trimestral" | "anual";

type CheckoutUrlKey = PaidPlan | "monthly" | "yearly";

export const CHECKOUT_URLS: Record<CheckoutUrlKey, string> = {
  single:         "https://pay.cakto.com.br/qw6rzxx_856330",
  mensal:         "https://pay.cakto.com.br/yw7ej87_856334",
  trimestral:     "https://pay.cakto.com.br/dvbmjwr",
  anual:          "https://pay.cakto.com.br/m6z7n3k_856339",
  max_mensal:     "https://pay.cakto.com.br/8hk6vba_996784",
  max_trimestral: "https://pay.cakto.com.br/aubz6ai",
  max_anual:      "https://pay.cakto.com.br/57bwznr_996791",
  monthly:        "https://pay.cakto.com.br/yw7ej87_856334",
  yearly:         "https://pay.cakto.com.br/m6z7n3k_856339",
};

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  single: "Geração única",
  mensal: "PRO Mensal",
  trimestral: "PRO Trimestral",
  anual: "PRO Anual",
  max_mensal: "MAX Mensal",
  max_trimestral: "MAX Trimestral",
  max_anual: "MAX Anual",
  dev: "Desenvolvedor",
};

export const PLAN_PRICES: Record<PaidPlan, string> = {
  single:         "R$ 14,90",
  mensal:         "R$ 49,90/mês",
  trimestral:     "R$ 127,90/trimestre",
  anual:          "R$ 397,90/ano",
  max_mensal:     "R$ 147,90/mês",
  max_trimestral: "R$ 377,90/trimestre",
  max_anual:      "R$ 1.175,00/ano",
};

/** Cota mensal de créditos por plano (renovável a cada mês). */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  mensal: 3200,
  trimestral: 3200,
  anual: 3200,
  max_mensal: 16000,
  max_trimestral: 16000,
  max_anual: 16000,
};

/** Bônus permanente concedido só na PRIMEIRA ativação da assinatura. */
export const PLAN_SIGNUP_BONUS: Record<string, number> = {
  mensal: 800,
  trimestral: 1200,
  anual: 2000,
  max_mensal: 0,
  max_trimestral: 0,
  max_anual: 0,
};

/** Créditos permanentes creditados por compra avulsa (400 + 100 de bônus). */
export const SINGLE_PURCHASE_CREDITS = 500;

/** Custo em créditos de uma geração: 10/slide + profundidade + falas. */
export const CREDITS_PER_SLIDE = 10;
export const DEPTH_CREDITS: Record<string, number> = { short: 10, balanced: 20, long: 30 };
export const SPEECHES_CREDITS = 50;
export const estimateCreditsCost = (
  slidesCount: number,
  textDepth: string = "balanced",
  includeSpeeches = false,
): number =>
  Math.max(5, Math.min(20, Math.round(slidesCount || 8))) * CREDITS_PER_SLIDE
  + (DEPTH_CREDITS[textDepth] ?? DEPTH_CREDITS.balanced)
  + (includeSpeeches ? SPEECHES_CREDITS : 0);

export const isProPlan = (p?: string | null) =>
  p === "mensal" || p === "trimestral" || p === "anual";
export const isMaxPlan = (p?: string | null) =>
  p === "max_mensal" || p === "max_trimestral" || p === "max_anual";
export const isSubscriptionPlan = (p?: string | null) => isProPlan(p) || isMaxPlan(p);

/** Retorna o id de plano PRO/MAX correspondente ao ciclo escolhido. */
export const proPlanFor  = (cycle: BillingCycle): PaidPlan =>
  cycle === "anual" ? "anual" : cycle === "trimestral" ? "trimestral" : "mensal";
export const maxPlanFor  = (cycle: BillingCycle): PaidPlan =>
  cycle === "anual" ? "max_anual" : cycle === "trimestral" ? "max_trimestral" : "max_mensal";
