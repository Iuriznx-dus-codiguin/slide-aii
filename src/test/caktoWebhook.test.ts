// Regras puras do webhook da Cakto que decidem dinheiro: o que um reembolso
// desfaz e como o e-mail do comprador é casado com a conta. Os testes Deno em
// supabase/functions/cakto-webhook/index.test.ts cobrem segredo, plano e
// classificação; estes rodam no vitest junto com o resto da suíte.

import { describe, expect, it } from "vitest";
import {
  escapeLike,
  extractCaktoId,
  extractEventType,
  PLAN_SIGNUP_BONUS,
  refundScopeFor,
  SINGLE_PURCHASE_CREDITS,
} from "../../supabase/functions/cakto-webhook/lib.ts";
import {
  PLAN_MONTHLY_CREDITS as CLIENT_MONTHLY,
  PLAN_SIGNUP_BONUS as CLIENT_BONUS,
  SINGLE_PURCHASE_CREDITS as CLIENT_SINGLE,
} from "../lib/cakto";
import { PLAN_MONTHLY_CREDITS } from "../../supabase/functions/cakto-webhook/lib.ts";

describe("refundScopeFor — reembolso desfaz só o que o pedido concedeu", () => {
  it("compra avulsa: retira até os créditos daquela compra e mantém o plano", () => {
    const s = refundScopeFor({ plan: "single", payloadSubscriptionId: null, profileSubscriptionId: "sub_ativa" });
    expect(s.kind).toBe("single");
    expect(s.revokeBonus).toBe(SINGLE_PURCHASE_CREDITS);
    expect(s.zeroMonthly).toBe(false);
    // Assinante que reembolsa uma compra avulsa NÃO perde a assinatura.
    expect(s.cancelSubscription).toBe(false);
  });

  it("assinatura vigente: cancela, zera a cota mensal e retira só o bônus daquele plano", () => {
    const s = refundScopeFor({ plan: "anual", payloadSubscriptionId: "sub_1", profileSubscriptionId: "sub_1" });
    expect(s.kind).toBe("subscription");
    expect(s.cancelSubscription).toBe(true);
    expect(s.zeroMonthly).toBe(true);
    expect(s.revokeBonus).toBe(PLAN_SIGNUP_BONUS.anual);
  });

  it("assinatura vigente sem id registrado no perfil também é tratada como a vigente", () => {
    expect(refundScopeFor({ plan: "mensal", payloadSubscriptionId: "sub_9", profileSubscriptionId: null }).kind).toBe("subscription");
  });

  it("reembolso de OUTRA assinatura: nada automático, vai para revisão", () => {
    const s = refundScopeFor({ plan: "mensal", payloadSubscriptionId: "sub_antiga", profileSubscriptionId: "sub_nova" });
    expect(s.kind).toBe("review");
    expect(s.revokeBonus).toBe(0);
    expect(s.cancelSubscription).toBe(false);
  });

  it("plano não identificado: nada automático, vai para revisão", () => {
    const s = refundScopeFor({ plan: undefined });
    expect(s.kind).toBe("review");
    expect(s.zeroMonthly).toBe(false);
  });
});

describe("idempotência: compra e reembolso do MESMO pedido não colidem", () => {
  // A Cakto manda o objeto do pedido em `data`: o reembolso chega com o mesmo
  // data.id da compra. A chave única agora é (event_type, cakto_id).
  const order = { id: "ord_123", status: "paid", customer: { email: "a@b.com" } };
  const purchase = { event: "purchase_approved", data: order };
  const refund = { event: "refund", data: { ...order, status: "refunded" } };

  it("mesmo id de pedido, eventos diferentes", () => {
    expect(extractCaktoId(purchase)).toBe(extractCaktoId(refund));
    expect(extractEventType(purchase)).not.toBe(extractEventType(refund));
  });
});

describe("escapeLike — e-mail não vira padrão curinga", () => {
  it("escapa _ % e barra", () => {
    expect(escapeLike("joao_silva@x.com")).toBe("joao\\_silva@x.com");
    expect(escapeLike("100%@x.com")).toBe("100\\%@x.com");
    expect(escapeLike("a\\b@x.com")).toBe("a\\\\b@x.com");
    expect(escapeLike("simples@x.com")).toBe("simples@x.com");
  });
});

describe("paridade de créditos: webhook × tela de planos", () => {
  it("mesmos valores de cota mensal, bônus de ativação e compra avulsa", () => {
    expect(CLIENT_SINGLE).toBe(SINGLE_PURCHASE_CREDITS);
    for (const plan of Object.keys(PLAN_MONTHLY_CREDITS)) {
      expect(CLIENT_MONTHLY[plan], plan).toBe(PLAN_MONTHLY_CREDITS[plan]);
      expect(CLIENT_BONUS[plan], plan).toBe(PLAN_SIGNUP_BONUS[plan]);
    }
  });
});
