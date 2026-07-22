// Links de checkout Cakto e mapeamento de planos.
//
// Planos:
// - "single":     Geração única (R$ 14,90)
// - "mensal":     PRO Mensal (R$ 49,90/mês)   — até 20 gerações/mês
// - "anual":      PRO Anual  (R$ 397,90/ano)  — até 20 gerações/mês
// - "max_mensal": MAX Mensal (R$ 147,90/mês)  — ilimitado (teto interno 100/mês)
// - "max_anual":  MAX Anual  (R$ 1.175,00/ano) — ilimitado (teto interno 100/mês)
export type PaidPlan = "single" | "mensal" | "anual" | "max_mensal" | "max_anual";

type CheckoutUrlKey = PaidPlan | "monthly" | "yearly";

// TODO: preencher os checkout links do plano MAX no Cakto quando disponíveis.
// Enquanto vazios, os botões abrem o WhatsApp/e-mail de contato como fallback.
export const CHECKOUT_URLS: Record<CheckoutUrlKey, string> = {
  single: "https://pay.cakto.com.br/qw6rzxx_856330",
  mensal: "https://pay.cakto.com.br/yw7ej87_856334",
  anual: "https://pay.cakto.com.br/m6z7n3k_856339",
  monthly: "https://pay.cakto.com.br/yw7ej87_856334",
  yearly: "https://pay.cakto.com.br/m6z7n3k_856339",
  max_mensal: "",
  max_anual: "",
};

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  single: "Geração única",
  mensal: "PRO Mensal",
  anual: "PRO Anual",
  max_mensal: "MAX Mensal",
  max_anual: "MAX Anual",
  dev: "Desenvolvedor",
};

export const PLAN_PRICES: Record<PaidPlan, string> = {
  single: "R$ 14,90",
  mensal: "R$ 49,90/mês",
  anual: "R$ 397,90/ano",
  max_mensal: "R$ 147,90/mês",
  max_anual: "R$ 1.175,00/ano",
};

/** Limite mensal de gerações por plano. MAX tem teto oculto de 100 (retorna erro genérico). */
export const PLAN_MONTHLY_LIMITS: Record<string, number> = {
  mensal: 20,
  anual: 20,
  max_mensal: 100,
  max_anual: 100,
};

export const isProPlan = (p?: string | null) => p === "mensal" || p === "anual";
export const isMaxPlan = (p?: string | null) => p === "max_mensal" || p === "max_anual";
export const isSubscriptionPlan = (p?: string | null) => isProPlan(p) || isMaxPlan(p);
