// Links de checkout Cakto e mapeamento de planos.
//
// Planos:
// - "single":         Geração única (R$ 14,90)
// - "mensal":         PRO Mensal      (R$ 49,90/mês)   — 20 gerações/mês
// - "trimestral":     PRO Trimestral  (R$ 127,90/3m)   — 20 gerações/mês  (~15% off)
// - "anual":          PRO Anual       (R$ 397,90/ano)  — 20 gerações/mês
// - "max_mensal":     MAX Mensal      (R$ 147,90/mês)  — ilimitado (teto interno 100/mês)
// - "max_trimestral": MAX Trimestral  (R$ 377,90/3m)   — ilimitado (teto interno 100/mês)
// - "max_anual":      MAX Anual       (R$ 1.175,00/ano) — ilimitado (teto interno 100/mês)
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

/** Limite mensal de gerações por plano. MAX tem teto oculto de 100 (retorna erro genérico). */
export const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  mensal: 20,
  trimestral: 20,
  anual: 20,
  max_mensal: 100,
  max_trimestral: 100,
  max_anual: 100,
};

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
