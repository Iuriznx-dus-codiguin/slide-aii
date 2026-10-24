// Planos, preços, créditos e custo de geração para as edge functions
// (e-mails, suporte e a cobrança em generate-presentation).
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

/** Preço de cada plano em centavos (os textos de PLAN_PRICES são derivados). */
export const PLAN_PRICE_CENTS: Record<PaidPlan, number> = {
  single:         1490,
  mensal:         3490,
  trimestral:     8890,
  anual:          27690,
  max_mensal:     14700,
  max_trimestral: 37500,
  max_anual:      116400,
};

export const formatBRL = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const PRICE_SUFFIX: Record<PaidPlan, string> = {
  single: "",
  mensal: "/mês", trimestral: "/trimestre", anual: "/ano",
  max_mensal: "/mês", max_trimestral: "/trimestre", max_anual: "/ano",
};

export const PLAN_PRICES = Object.fromEntries(
  (Object.keys(PLAN_PRICE_CENTS) as PaidPlan[]).map((p) => [p, `R$ ${formatBRL(PLAN_PRICE_CENTS[p])}${PRICE_SUFFIX[p]}`]),
) as Record<PaidPlan, string>;

export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  mensal: 1700, trimestral: 1700, anual: 1700,
  max_mensal: 8500, max_trimestral: 8500, max_anual: 8500,
};

/** O teto de uso justo do MAX em múltiplos da cota do PRO ("5x mais uso"). */
export const MAX_USAGE_MULTIPLIER = PLAN_MONTHLY_CREDITS.max_mensal / PLAN_MONTHLY_CREDITS.mensal;

export const SINGLE_PURCHASE_CREDITS = 500;

// ── Custo de uma geração (cobrado em generate-presentation) ──
export const MIN_SLIDES = 5;
export const MAX_SLIDES = 20;
export const CREDITS_PER_SLIDE = 10;
export const DEPTH_CREDITS: Record<string, number> = { short: 10, balanced: 20, long: 30 };
export const SPEECHES_CREDITS = 50;

export function computeCreditsCost(input: {
  slidesCount: number;
  textDepth?: string | null;
  includeSpeeches?: boolean;
}): number {
  const slides = Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(input.slidesCount || 8)));
  return slides * CREDITS_PER_SLIDE
    + (DEPTH_CREDITS[input.textDepth ?? "balanced"] ?? DEPTH_CREDITS.balanced)
    + (input.includeSpeeches ? SPEECHES_CREDITS : 0);
}

/** Uma apresentação de 10 slides, profundidade equilibrada, sem falas (120). */
export const TYPICAL_DECK_CREDITS = computeCreditsCost({ slidesCount: 10, textDepth: "balanced" });

/**
 * Apresentação de referência das estimativas de volume divulgadas: 10 slides,
 * equilibrada, com falas (170). Avulso ≈ 3, PRO ≈ 10 por mês, MAX ≈ 50.
 */
export const REFERENCE_DECK_CREDITS = computeCreditsCost({ slidesCount: 10, textDepth: "balanced", includeSpeeches: true });
export const estimatedDecks = (credits: number): number => Math.round(Math.max(0, credits) / REFERENCE_DECK_CREDITS);

export const SUBSCRIPTION_PLANS = ["mensal", "trimestral", "anual", "max_mensal", "max_trimestral", "max_anual"] as const;

export const isSubscriptionPlan = (p?: string | null): boolean =>
  !!p && (SUBSCRIPTION_PLANS as readonly string[]).includes(p);

export const isMaxPlan = (p?: string | null): boolean => !!p && p.startsWith("max_");

/** Desconto do trimestral/anual sobre o mensal do mesmo plano, em % inteiro. */
export const cycleDiscountPct = (p: PaidPlan): number => {
  const months = p.endsWith("anual") ? 12 : p.endsWith("trimestral") ? 3 : 1;
  const monthly = PLAN_PRICE_CENTS[isMaxPlan(p) ? "max_mensal" : "mensal"];
  return Math.round((1 - PLAN_PRICE_CENTS[p] / (monthly * months)) * 100);
};

/** Plano MAX do mesmo ciclo (para upgrade). */
export const maxPlanFor = (p?: string | null): PaidPlan => {
  if (p === "trimestral" || p === "max_trimestral") return "max_trimestral";
  if (p === "anual" || p === "max_anual") return "max_anual";
  return "max_mensal";
};

/** Ordem de "tamanho" do plano, para reconhecer upgrade. */
export const planRank = (p?: string | null): number => (isMaxPlan(p) ? 2 : isSubscriptionPlan(p) ? 1 : 0);
