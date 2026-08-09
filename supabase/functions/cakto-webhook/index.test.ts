// Testes automatizados do webhook da Cakto.
// Cobrem: validação do segredo (todas as formas de envio — o que causava 401),
// resolução de plano e classificação dos eventos purchase_approved,
// subscription_created, subscription_renewed, subscription_canceled,
// refunded e chargeback.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  addMonths, classifyEvent, collectProvidedSecrets, cyclePeriodMonths,
  extractCaktoId, extractEmail, extractEventType, extractStatus,
  hasValidSecret, resolvePlan,
} from "./lib.ts";

// Valor fictício: testes nunca devem conter o segredo real do webhook.
const SECRET = "test-only-cakto-webhook-secret";

const payloadFor = (event: string, overrides: Record<string, unknown> = {}) => ({
  secret: SECRET,
  event,
  data: {
    id: `evt_${event}`,
    status: event === "purchase_approved" ? "paid" : undefined,
    customer: { id: "cus_1", email: "Cliente@Example.com" },
    subscription: { id: "sub_1" },
    checkoutUrl: "https://pay.cakto.com.br/yw7ej87_856334",
    ...overrides,
  },
});

const authorized = (payload: unknown, headers: Record<string, string> = {}, url = "https://x/functions/v1/cakto-webhook") =>
  hasValidSecret(collectProvidedSecrets(new Headers(headers), url, payload), SECRET);

/* ------------------------- validação do segredo ------------------------- */

Deno.test("aceita segredo no corpo (formato oficial da Cakto)", () => {
  assertEquals(authorized(payloadFor("purchase_approved")), true);
});

Deno.test("aceita segredo em headers alternativos", () => {
  const body = { event: "purchase_approved" };
  assertEquals(authorized(body, { "x-cakto-token": SECRET }), true);
  assertEquals(authorized(body, { "x-cakto-secret": SECRET }), true);
  assertEquals(authorized(body, { "x-webhook-secret": SECRET }), true);
  assertEquals(authorized(body, { "x-signature": SECRET }), true);
  assertEquals(authorized(body, { authorization: `Bearer ${SECRET}` }), true);
});

Deno.test("rejeita segredo em query param para evitar vazamento em logs", () => {
  const url = `https://x/functions/v1/cakto-webhook?token=${SECRET}`;
  assertEquals(authorized({ event: "purchase_approved" }, {}, url), false);
  assertEquals(authorized({ event: "purchase_approved" }, {}, `https://x/f?secret=${SECRET}`), false);
});

Deno.test("aceita segredo em envelopes usados por integrações", () => {
  assertEquals(authorized({ payload: { secret: SECRET } }), true);
  assertEquals(authorized({ event_data: { token: SECRET } }), true);
});

Deno.test("tolera espaços e prefixos no segredo", () => {
  assertEquals(authorized({ secret: `  ${SECRET}  ` }), true);
  assertEquals(authorized({}, { authorization: `Token ${SECRET}` }), true);
});

Deno.test("rejeita segredo ausente ou incorreto (401)", () => {
  assertEquals(authorized({ event: "purchase_approved" }), false);
  assertEquals(authorized({ secret: "errado" }), false);
  assertEquals(hasValidSecret([SECRET], ""), false);
  assertEquals(hasValidSecret([SECRET], undefined), false);
});

/* --------------------------- eventos oficiais --------------------------- */

Deno.test("purchase_approved → paid, com plano e e-mail normalizado", () => {
  const p = payloadFor("purchase_approved");
  assertEquals(authorized(p), true);
  assertEquals(classifyEvent(extractEventType(p), extractStatus(p)), "paid");
  assertEquals(resolvePlan(p), "mensal");
  assertEquals(extractEmail(p), "cliente@example.com");
  assertEquals(extractCaktoId(p), "evt_purchase_approved");
});

Deno.test("purchase_approved de geração única → plano single", () => {
  const p = payloadFor("purchase_approved", {
    checkoutUrl: "https://pay.cakto.com.br/qw6rzxx_856330",
  });
  assertEquals(resolvePlan(p), "single");
  assertEquals(cyclePeriodMonths("single"), null);
});

Deno.test("subscription_created → paid", () => {
  const p = payloadFor("subscription_created");
  assertEquals(authorized(p), true);
  assertEquals(classifyEvent(extractEventType(p), extractStatus(p)), "paid");
});

Deno.test("subscription_renewed → paid e estende o ciclo", () => {
  const p = payloadFor("subscription_renewed", {
    checkoutUrl: "https://pay.cakto.com.br/57bwznr_996791",
  });
  assertEquals(classifyEvent(extractEventType(p), extractStatus(p)), "paid");
  assertEquals(resolvePlan(p), "max_anual");
  assertEquals(cyclePeriodMonths("max_anual"), 12);
  assertEquals(
    addMonths(new Date("2026-01-31T00:00:00Z"), 1).toISOString().slice(0, 10),
    "2026-02-28",
  );
});

Deno.test("subscription_canceled → canceled (não confunde com paid)", () => {
  const p = payloadFor("subscription_canceled");
  assertEquals(authorized(p), true);
  assertEquals(classifyEvent(extractEventType(p), extractStatus(p)), "canceled");
});

Deno.test("refund e chargeback → refund (precedência sobre canceled)", () => {
  for (const ev of ["refunded", "refund", "chargeback", "chargedback"]) {
    const p = payloadFor(ev);
    assertEquals(authorized(p), true);
    assertEquals(classifyEvent(extractEventType(p), extractStatus(p)), "refund");
  }
  assertEquals(classifyEvent("subscription_canceled", "refunded"), "refund");
});

Deno.test("evento desconhecido é ignorado sem erro", () => {
  assertEquals(classifyEvent("pix_generated", "waiting_payment"), "ignored");
});

/* --------------------- mapeamento completo de checkouts ------------------ */

Deno.test("todos os checkouts mapeiam para o plano correto", () => {
  const expected: Record<string, string> = {
    qw6rzxx_856330: "single",
    yw7ej87_856334: "mensal",
    dvbmjwr: "trimestral",
    m6z7n3k_856339: "anual",
    "8hk6vba_996784": "max_mensal",
    aubz6ai: "max_trimestral",
    "57bwznr_996791": "max_anual",
  };
  for (const [slug, plan] of Object.entries(expected)) {
    assertEquals(
      resolvePlan(payloadFor("purchase_approved", { checkoutUrl: `https://pay.cakto.com.br/${slug}` })),
      plan,
      `checkout ${slug}`,
    );
  }
  // fallback por product_id
  assertEquals(
    resolvePlan({ event: "purchase_approved", data: { product: { id: "996784" } } }),
    "max_mensal",
  );
});
