// Links de checkout Cakto e mapeamento de planos.
export type PaidPlan = "single" | "mensal" | "anual";

// A landing page (src/components/landing/Pricing.tsx) referencia os planos
// mensal/anual em inglês (monthly/yearly), enquanto o restante do app usa os
// nomes em português (mensal/anual) — ambas as chaves apontam para a MESMA
// URL de checkout. Antes isso exigia "as any" duas vezes (nas chaves extras e
// no objeto inteiro) porque o tipo só previa PaidPlan; declarando as chaves
// extras explicitamente, o objeto fica 100% tipado e qualquer chave inválida
// (ex: erro de digitação) volta a ser pega em tempo de compilação.
type CheckoutUrlKey = PaidPlan | "monthly" | "yearly";

export const CHECKOUT_URLS: Record<CheckoutUrlKey, string> = {
  single: "https://pay.cakto.com.br/qw6rzxx_856330",
  mensal: "https://pay.cakto.com.br/yw7ej87_856334",
  anual: "https://pay.cakto.com.br/m6z7n3k_856339",
  monthly: "https://pay.cakto.com.br/yw7ej87_856334",
  yearly: "https://pay.cakto.com.br/m6z7n3k_856339",
};

// "Ilimitado" foi trocado por uma descrição honesta do volume real (20
// gerações/mês, aplicado por can_user_generate no banco) — o rótulo anterior
// prometia uso ilimitado e o próprio produto bloqueia no vigésimo uso do mês,
// o que gera uma contradição direta para quem já pagou pelo plano.
export const PLAN_LABELS: Record<string, string> = {
  free: "Gratuito",
  single: "Geração única",
  mensal: "Plano Mensal",
  anual: "Plano Anual",
  dev: "Desenvolvedor",
};

export const PLAN_PRICES: Record<PaidPlan, string> = {
  single: "R$ 14,90",
  mensal: "R$ 49,90/mês",
  anual: "R$ 397,90/ano",
};
