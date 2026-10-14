// Regras puras do webhook da Cakto que decidem dinheiro: o que um reembolso
// desfaz e como o e-mail do comprador é casado com a conta. Os testes Deno em
// supabase/functions/cakto-webhook/index.test.ts cobrem segredo, plano e
// classificação; estes rodam no vitest junto com o resto da suíte.

import { describe, expect, it } from "vitest";
import {
  classifyEvent,
  escapeLike,
  extractCaktoId,
  isActiveSubscriber,
  isOtherSubscriptionEvent,
  extractEventType,
  resolveUserId,
  safeEventLabel,
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
import { isMonthlyCycleDue } from "../lib/cakto";

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

describe("classifyEvent — recusas e cobranças apenas geradas nunca contam como pagamento", () => {
  // A Cakto manda o pedido inteiro em `data`; nos próprios testes dela o
  // status vem "paid" até em eventos de recusa.
  it.each([
    ["subscription_renewal_refused", "paid"],
    ["purchase_refused", "paid"],
    ["pix_gerado", "paid"],
    ["boleto_gerado", "waiting_payment"],
    ["picpay_gerado", "paid"],
    ["checkout_abandonment", "paid"],
  ])("%s → ignorado", (event, status) => {
    expect(classifyEvent(event, status)).toBe("ignored");
  });

  it("pagamentos reais continuam como pagos; reembolso e cancelamento mantêm a precedência", () => {
    expect(classifyEvent("purchase_approved", "paid")).toBe("paid");
    expect(classifyEvent("subscription_renewed", "paid")).toBe("paid");
    expect(classifyEvent("subscription_created", "active")).toBe("paid");
    expect(classifyEvent("refund", "paid")).toBe("refund");
    expect(classifyEvent("chargeback", "paid")).toBe("refund");
    expect(classifyEvent("subscription_canceled", "paid")).toBe("canceled");
  });
});

describe("isActiveSubscriber — assinatura que ainda dá acesso", () => {
  const now = new Date("2026-09-27T12:00:00Z");
  it("ativa e dentro do período", () => {
    expect(isActiveSubscriber({ plan: "mensal", subscription_status: "active", subscription_renews_at: "2026-10-10T00:00:00Z" }, now)).toBe(true);
  });
  it("vencida (renovação passou) não conta — o avulso comprado depois precisa valer", () => {
    expect(isActiveSubscriber({ plan: "mensal", subscription_status: "active", subscription_renews_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
  });
  it("cancelada dentro do período pago continua assinante (Termos, seção 7)", () => {
    expect(isActiveSubscriber({ plan: "anual", subscription_status: "canceled", subscription_renews_at: "2027-01-01T00:00:00Z" }, now)).toBe(true);
  });
  it("cancelada com o período encerrado ou sem data de fim não conta", () => {
    expect(isActiveSubscriber({ plan: "anual", subscription_status: "canceled", subscription_renews_at: "2026-09-01T00:00:00Z" }, now)).toBe(false);
    expect(isActiveSubscriber({ plan: "anual", subscription_status: "canceled", subscription_renews_at: null }, now)).toBe(false);
  });
  it("avulso, sem plano ou status inadimplente não contam", () => {
    expect(isActiveSubscriber({ plan: "single" }, now)).toBe(false);
    expect(isActiveSubscriber(null, now)).toBe(false);
    expect(isActiveSubscriber({ plan: "mensal", subscription_status: "past_due", subscription_renews_at: "2026-10-10T00:00:00Z" }, now)).toBe(false);
  });
});

describe("isMonthlyCycleDue — cota renova 1 mês após o início do ciclo (igual ao banco)", () => {
  it("renova exatamente um mês depois da âncora, não no dia 1º", () => {
    expect(isMonthlyCycleDue("2026-09-25", new Date("2026-10-01T00:00:00Z"))).toBe(false);
    expect(isMonthlyCycleDue("2026-09-25", new Date("2026-10-24T23:59:59Z"))).toBe(false);
    expect(isMonthlyCycleDue("2026-09-25", new Date("2026-10-25T00:00:00Z"))).toBe(true);
  });
  it("âncoras antigas no dia 1º continuam renovando no dia 1º", () => {
    expect(isMonthlyCycleDue("2026-09-01", new Date("2026-09-30T23:00:00Z"))).toBe(false);
    expect(isMonthlyCycleDue("2026-09-01", new Date("2026-10-01T00:00:00Z"))).toBe(true);
  });
  it("fim de mês com o mesmo corte do Postgres (31/01 + 1 mês = 28/02)", () => {
    expect(isMonthlyCycleDue("2027-01-31", new Date("2027-02-27T23:00:00Z"))).toBe(false);
    expect(isMonthlyCycleDue("2027-01-31", new Date("2027-02-28T00:00:00Z"))).toBe(true);
  });
  it("sem âncora, a cota está disponível", () => {
    expect(isMonthlyCycleDue(null)).toBe(true);
  });
});

describe("classifyEvent — eventos oficiais da Cakto (payload de teste traz status paid)", () => {
  it.each([
    ["webhook_test", "ignored"], ["refund_requested", "ignored"], ["subscription_late", "ignored"],
    ["subscription_renewal_refused", "ignored"], ["purchase_refused", "ignored"], ["pix_gerado", "ignored"],
    ["boleto_gerado", "ignored"], ["picpay_gerado", "ignored"], ["checkout_abandonment", "ignored"],
    ["subscription_paused", "paused"], ["subscription_resumed", "resumed"],
    ["subscription_late_recovered", "paid"], ["refund", "refund"], ["chargeback", "refund"],
  ])("%s → %s", (event, expected) => {
    expect(classifyEvent(event, "paid")).toBe(expected);
  });
});

describe("isOtherSubscriptionEvent — evento de outra assinatura não mexe na vigente", () => {
  const base = { payloadSubscriptionId: "sub_A", profileSubscriptionId: "sub_B", profileIsActive: true, renewal: false, knownSubscription: false };

  it("cancelar a assinatura antiga depois de assinar a nova não cancela a nova", () => {
    expect(isOtherSubscriptionEvent({ ...base, action: "canceled" })).toBe(true);
    expect(isOtherSubscriptionEvent({ ...base, action: "canceled", payloadSubscriptionId: "sub_B" })).toBe(false);
  });

  it("renovação da antiga com a nova ativa não troca plano nem cota", () => {
    expect(isOtherSubscriptionEvent({ ...base, action: "paid", renewal: true })).toBe(true);
    expect(isOtherSubscriptionEvent({ ...base, action: "paid", knownSubscription: true })).toBe(true);
  });

  it("assinatura NOVA (troca de plano) e reassinatura depois do fim continuam valendo", () => {
    expect(isOtherSubscriptionEvent({ ...base, action: "paid" })).toBe(false);
    expect(isOtherSubscriptionEvent({ ...base, action: "paid", renewal: true, profileIsActive: false })).toBe(false);
  });

  it("sem id no evento ou no perfil (legado), nada muda", () => {
    expect(isOtherSubscriptionEvent({ ...base, action: "canceled", payloadSubscriptionId: null })).toBe(false);
    expect(isOtherSubscriptionEvent({ ...base, action: "canceled", profileSubscriptionId: null })).toBe(false);
  });
});

describe("resolveUserId — conta do evento além do e-mail atual", () => {
  const lookup = (found: Partial<Record<string, string>>) => {
    const calls: string[] = [];
    const step = (name: string) => async (v: string) => { calls.push(`${name}:${v}`); return found[name] ?? null; };
    return {
      calls,
      api: {
        bySubscription: step("subscription"), byOrder: step("order"), byEmail: step("email"),
        byPurchaseEmail: step("purchase_email"), byCustomer: step("customer"),
      },
    };
  };

  it("assinatura registrada vence o e-mail (conta trocou de e-mail depois de assinar)", async () => {
    const l = lookup({ subscription: "u-sub", email: "u-email" });
    expect(await resolveUserId({ subscriptionId: "sub_1", email: "antigo@x.com" }, l.api)).toEqual({ userId: "u-sub", via: "subscription" });
  });

  it("reembolso acha a conta pela aprovação do mesmo pedido", async () => {
    const l = lookup({ order: "u-order" });
    expect(await resolveUserId({ orderId: "ord_1", email: "antigo@x.com" }, l.api)).toEqual({ userId: "u-order", via: "order" });
  });

  it("compra nova: e-mail atual, depois e-mail de compra anterior, depois cliente da Cakto", async () => {
    const l = lookup({ purchase_email: "u-old" });
    expect(await resolveUserId({ subscriptionId: "sub_new", orderId: "ord_new", email: "a@x.com", customerId: "cus_1" }, l.api))
      .toEqual({ userId: "u-old", via: "purchase_email" });
    expect(l.calls).toEqual(["subscription:sub_new", "order:ord_new", "email:a@x.com", "purchase_email:a@x.com"]);
  });

  it("nenhuma chave casa: usuário não encontrado", async () => {
    expect(await resolveUserId({ email: "x@x.com" }, lookup({}).api)).toEqual({ userId: null, via: null });
  });
});

describe("safeEventLabel — texto de chamada sem segredo não vai para o alerta", () => {
  it("mantém tipos válidos e troca texto livre", () => {
    expect(safeEventLabel("purchase_approved")).toBe("purchase_approved");
    expect(safeEventLabel("AÇÃO NECESSÁRIA: confirme em https://cakto-verify.example")).toBe("(inválido)");
    expect(safeEventLabel("x".repeat(41))).toBe("(inválido)");
    expect(safeEventLabel("")).toBeNull();
  });
});
