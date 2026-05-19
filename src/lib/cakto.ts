// Links de checkout Cakto e mapeamento de planos.
export type PaidPlan = "single" | "mensal" | "anual";

export const CHECKOUT_URLS: Record<PaidPlan, string> = {
  single: "https://pay.cakto.com.br/qw6rzxx_856330",
  monthly: "https://pay.cakto.com.br/yw7ej87_856334" as any,
  yearly: "https://pay.cakto.com.br/m6z7n3k_856339" as any,
  mensal: "https://pay.cakto.com.br/yw7ej87_856334",
  anual: "https://pay.cakto.com.br/m6z7n3k_856339",
} as any;

export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  single: "Geração única",
  mensal: "Ilimitado Mensal",
  anual: "Ilimitado Anual",
  dev: "Desenvolvedor",
};

export const PLAN_PRICES: Record<PaidPlan, string> = {
  single: "R$ 14,90",
  mensal: "R$ 49,90/mês",
  anual: "R$ 397,90/ano",
};
