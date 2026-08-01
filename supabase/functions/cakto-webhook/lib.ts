// Lógica pura do webhook da Cakto — extraída para permitir testes automatizados
// sem depender de rede, banco ou segredos de produção.

export type Plan =
  | "single"
  | "mensal" | "trimestral" | "anual"
  | "max_mensal" | "max_trimestral" | "max_anual";

export type EventAction = "paid" | "canceled" | "refund" | "ignored";

/** Mapeamento por short_id do checkout Cakto → plano interno. */
export const PLAN_BY_CHECKOUT_ID: Record<string, Plan> = {
  qw6rzxx_856330: "single",
  yw7ej87_856334: "mensal",
  dvbmjwr: "trimestral",
  m6z7n3k_856339: "anual",
  "8hk6vba_996784": "max_mensal",
  aubz6ai: "max_trimestral",
  "57bwznr_996791": "max_anual",
};

/** Fallback por product_id (raro; Cakto normalmente entrega short_id). */
export const PLAN_BY_PRODUCT_ID: Record<string, Plan> = {
  "856330": "single",
  "856334": "mensal",
  "856339": "anual",
  "996784": "max_mensal",
  "996791": "max_anual",
};

export const dig = (obj: any, paths: string[]): any => {
  for (const p of paths) {
    const v = p.split(".").reduce((a: any, k: string) => (a == null ? a : a[k]), obj);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

export const normalizeSecret = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/^Bearer\s+/i, "")
    .replace(/^Token\s+/i, "")
    .replace(/^Secret\s+/i, "")
    .trim();
};

export const hasValidSecret = (
  providedValues: Array<string | null | undefined>,
  expected: string | null | undefined,
): boolean => {
  const normalizedExpected = normalizeSecret(expected);
  if (!normalizedExpected) return false;
  return providedValues.some((value) => normalizeSecret(value) === normalizedExpected);
};

/** Coleta todos os lugares onde a Cakto pode enviar o segredo. */
export const collectProvidedSecrets = (
  headers: Headers,
  url: string,
  payload: any,
): Array<string | null> => {
  const search = new URL(url).searchParams;
  return [
    headers.get("x-cakto-token"),
    headers.get("x-cakto-secret"),
    headers.get("x-webhook-secret"),
    headers.get("x-signature"),
    headers.get("authorization"),
    search.get("token"),
    search.get("secret"),
    typeof payload?.secret === "string" ? payload.secret : null,
    typeof payload?.data?.secret === "string" ? payload.data.secret : null,
  ];
};

export const extractEventType = (payload: any): string =>
  String(dig(payload, ["event", "type", "data.event", "status"]) ?? "").toLowerCase();

export const extractStatus = (payload: any): string | undefined =>
  (dig(payload, ["data.status", "status", "data.transaction.status", "payment_status"]) as
    | string
    | undefined)?.toLowerCase();

export const extractEmail = (payload: any): string | undefined =>
  (dig(payload, [
    "data.customer.email", "customer.email", "data.buyer.email",
    "buyer.email", "data.email", "email",
  ]) as string | undefined)?.toLowerCase();

export const extractCaktoId = (payload: any): string | undefined =>
  dig(payload, ["data.id", "id", "data.transaction.id", "transaction_id"]) as string | undefined;

export const resolvePlan = (payload: any): Plan | undefined => {
  const checkoutSlug = dig(payload, [
    "data.product.short_id", "data.product.slug", "data.checkout.slug",
    "checkout.slug", "product.slug", "data.product.checkout_id",
  ]) as string | undefined;
  const productId = String(dig(payload, [
    "data.product.id", "product.id", "data.offer.id", "offer.id", "data.refId", "refId",
  ]) ?? "");
  const checkoutUrl = dig(payload, [
    "data.checkoutUrl", "checkoutUrl", "data.checkout_url", "checkout_url",
  ]) as string | undefined;
  const slugFromUrl = checkoutUrl?.match(/pay\.cakto\.com\.br\/([^/?#]+)/i)?.[1];

  return (checkoutSlug && PLAN_BY_CHECKOUT_ID[checkoutSlug])
    || (slugFromUrl && PLAN_BY_CHECKOUT_ID[slugFromUrl])
    || PLAN_BY_PRODUCT_ID[productId]
    || undefined;
};

const PAID_HINTS = [
  "purchase_approved", "subscription_created", "subscription_renewed",
  "approved", "paid", "completed", "success", "active", "renewed",
];
const CANCEL_HINTS = ["subscription_canceled", "subscription_cancelled", "canceled", "cancelled"];
const REFUND_HINTS = ["refunded", "refund", "chargeback", "chargedback"];

/** Reembolso/chargeback tem precedência sobre cancelamento, e cancelamento sobre pagamento. */
export const classifyEvent = (eventType: string, status?: string): EventAction => {
  const haystack = `${eventType ?? ""} ${status ?? ""}`.toLowerCase();
  if (REFUND_HINTS.some((h) => haystack.includes(h))) return "refund";
  if (CANCEL_HINTS.some((h) => haystack.includes(h))) return "canceled";
  if (PAID_HINTS.some((h) => haystack.includes(h))) return "paid";
  return "ignored";
};

/** Adiciona `months` meses preservando o dia (com clamp no fim do mês). */
export const addMonths = (d: Date, months: number): Date => {
  const r = new Date(d.getTime());
  const day = r.getDate();
  r.setMonth(r.getMonth() + months);
  if (r.getDate() < day) r.setDate(0);
  return r;
};

export const cyclePeriodMonths = (plan: Plan): number | null => {
  if (plan === "mensal" || plan === "max_mensal") return 1;
  if (plan === "trimestral" || plan === "max_trimestral") return 3;
  if (plan === "anual" || plan === "max_anual") return 12;
  return null;
};
