// Planos, preços e links de checkout para as edge functions (e-mails).
// Espelho de src/lib/cakto.ts — o teste src/test/plansParity.test.ts garante
// que os dois continuam iguais.

export type PaidPlan =
  | "single"
  | "mensal" | "trimestral" | "anual"
  | "max_mensal" | "max_trimestral" | "max_anual";

export const CHECKOUT_URLS: Record<PaidPlan, string> = {
  single:         "https://pay.cakto.com.br/qw6rzxx_856330",
  mensal:         "https://pay.cakto.com.br/yw7ej87_856334",
  trimestral:     "https://pay.cakto.com.br/dvbmjwr",
  anual:          "https://pay.cakto.com.br/m6z7n3k_856339",
  max_mensal:     "https://pay.cakto.com.br/8hk6vba_996784",
  max_trimestral: "https://pay.cakto.com.br/aubz6ai",
  max_anual:      "https://pay.cakto.com.br/57bwznr_996791",
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

export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  mensal: 3200, trimestral: 3200, anual: 3200,
  max_mensal: 16000, max_trimestral: 16000, max_anual: 16000,
};

export const PLAN_SIGNUP_BONUS: Record<string, number> = {
  mensal: 800, trimestral: 1200, anual: 2000,
  max_mensal: 0, max_trimestral: 0, max_anual: 0,
};

export const SINGLE_PURCHASE_CREDITS = 500;

/** Uma apresentação de 10 slides, profundidade equilibrada, sem falas. */
export const TYPICAL_DECK_CREDITS = 120;

export const SUBSCRIPTION_PLANS = ["mensal", "trimestral", "anual", "max_mensal", "max_trimestral", "max_anual"] as const;

export const isSubscriptionPlan = (p?: string | null): boolean =>
  !!p && (SUBSCRIPTION_PLANS as readonly string[]).includes(p);

export const isMaxPlan = (p?: string | null): boolean => !!p && p.startsWith("max_");

/** Plano MAX do mesmo ciclo (para upgrade). */
export const maxPlanFor = (p?: string | null): PaidPlan => {
  if (p === "trimestral" || p === "max_trimestral") return "max_trimestral";
  if (p === "anual" || p === "max_anual") return "max_anual";
  return "max_mensal";
};

/** Ordem de "tamanho" do plano, para reconhecer upgrade. */
export const planRank = (p?: string | null): number => (isMaxPlan(p) ? 2 : isSubscriptionPlan(p) ? 1 : 0);
