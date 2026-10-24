// Links de checkout Cakto e mapeamento de planos.
//
// Planos (tabela de 10/2026; preços também em supabase/functions/_shared/plans.ts):
// - "single":         Geração única   (R$ 14,90)         — 500 créditos permanentes
// - "mensal":         PRO Mensal      (R$ 34,90/mês)     — 1.700 créditos/mês
// - "trimestral":     PRO Trimestral  (R$ 88,90/3m)      — 1.700 créditos/mês  (-15%)
// - "anual":          PRO Anual       (R$ 276,90/ano)    — 1.700 créditos/mês  (-34%)
// - "max_mensal":     MAX Mensal      (R$ 147,00/mês)    — ilimitado (8.500 créditos/mês, 5x o PRO)
// - "max_trimestral": MAX Trimestral  (R$ 375,00/3m)     — ilimitado (8.500 créditos/mês)  (-15%)
// - "max_anual":      MAX Anual       (R$ 1.164,00/ano)  — ilimitado (8.500 créditos/mês)  (-34%)
//
// Assinaturas não têm bônus de ativação: a vantagem dos ciclos longos é o
// desconto. Os preços cobrados são os das ofertas no painel da Cakto — ao
// mudar um valor aqui, mude a oferta correspondente lá.
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

/** Meses cobertos por um pagamento de cada ciclo. */
export const CYCLE_MONTHS: Record<BillingCycle, number> = { mensal: 1, trimestral: 3, anual: 12 };

/** Preço de cada plano em centavos — fonte única; os textos abaixo são derivados. */
export const PLAN_PRICE_CENTS: Record<PaidPlan, number> = {
  single:         1490,
  mensal:         3490,
  trimestral:     8890,
  anual:          27690,
  max_mensal:     14700,
  max_trimestral: 37500,
  max_anual:      116400,
};

/**
 * Preço anterior das assinaturas (tabela até 10/2026), exibido riscado ao
 * lado do preço atual. A compra avulsa não mudou e não tem preço anterior.
 */
export const PLAN_PREVIOUS_PRICE_CENTS: Partial<Record<PaidPlan, number>> = {
  mensal:         4990,
  trimestral:     12790,
  anual:          39790,
  max_mensal:     14790,
  max_trimestral: 37790,
  max_anual:      117500,
};

/** "1.164,00" a partir de 116400 centavos. */
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

/** Cota mensal de créditos por plano (renovável a cada mês). */
export const PLAN_MONTHLY_CREDITS: Record<string, number> = {
  mensal: 1700,
  trimestral: 1700,
  anual: 1700,
  max_mensal: 8500,
  max_trimestral: 8500,
  max_anual: 8500,
};

/** Quantas vezes o uso do MAX (teto de uso justo) cabe no PRO: "5x mais uso". */
export const MAX_USAGE_MULTIPLIER = PLAN_MONTHLY_CREDITS.max_mensal / PLAN_MONTHLY_CREDITS.mensal;

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

/**
 * Apresentação de referência das estimativas de volume ("≈ 10 apresentações
 * por mês"): 10 slides, profundidade equilibrada, com falas — 170 créditos.
 * É a mesma proporção do avulso divulgado (500 créditos ≈ 3 apresentações).
 */
export const REFERENCE_DECK_CREDITS = estimateCreditsCost(10, "balanced", true);
/** Apresentações de referência que um volume de créditos rende (estimativa divulgada). */
export const estimatedDecks = (credits: number): number => Math.round(Math.max(0, credits) / REFERENCE_DECK_CREDITS);

/** Desconto de um ciclo sobre o mesmo plano pago mês a mês, em % inteiro. */
export const cycleDiscountPct = (plan: PaidPlan, cycle: BillingCycle): number => {
  const monthly = PLAN_PRICE_CENTS[isMaxPlan(plan) ? "max_mensal" : "mensal"];
  return Math.round((1 - PLAN_PRICE_CENTS[plan] / (monthly * CYCLE_MONTHS[cycle])) * 100);
};

/** Preço por mês de um ciclo ("29,63"). */
export const monthlyEquivalent = (plan: PaidPlan, cycle: BillingCycle): string =>
  formatBRL(Math.round(PLAN_PRICE_CENTS[plan] / CYCLE_MONTHS[cycle]));

/** Redução do preço anterior para o atual, em % inteiro (0 sem preço anterior). */
export const previousPriceDiscountPct = (plan: PaidPlan): number => {
  const before = PLAN_PREVIOUS_PRICE_CENTS[plan];
  return before ? Math.round((1 - PLAN_PRICE_CENTS[plan] / before) * 100) : 0;
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

/**
 * A cota mensal renova 1 mês depois do início do ciclo (credits_cycle_anchor,
 * dia da ativação/renovação), igual a ensure_monthly_credits no banco.
 * Antes era por mês-calendário (dia 1º) — somado ao reset na renovação, um
 * plano mensal recarregava duas vezes por mês.
 *
 * `anchor` é uma data "AAAA-MM-DD" (UTC). Soma de mês com o mesmo corte do
 * Postgres: 31/01 + 1 mês = 28/02 (ou 29 em ano bissexto).
 */
export const isMonthlyCycleDue = (anchor: string | null | undefined, now: Date = new Date()): boolean => {
  if (!anchor) return true;
  const [y, m, d] = anchor.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return true;
  const lastDayNext = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); // último dia do mês seguinte
  const due = Date.UTC(y, m, Math.min(d, lastDayNext));
  return now.getTime() >= due;
};
