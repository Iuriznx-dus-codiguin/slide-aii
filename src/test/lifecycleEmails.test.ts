import { describe, expect, it } from "vitest";
import { renderLayout, renderText } from "../../supabase/functions/_shared/emailTemplates.ts";
import {
  buildLifecycleEmail, COUPONS, firstNameOf, greeting, LIFECYCLE_TEMPLATES, type LifecycleContext,
  normalizePersona, paymentLabel, SENDERS,
} from "../../supabase/functions/_shared/lifecycleTemplates.ts";
import {
  frequencyDelay, nextAllowedTime, type RuleContext, shouldSend,
} from "../../supabase/functions/_shared/lifecycleRules.ts";
import {
  billingAlertFor, billingSnapshotFrom, pendingChargeFrom,
} from "../../supabase/functions/cakto-webhook/lib.ts";
import { SAMPLE_LIFECYCLE } from "../../scripts/email-preview.ts";

// Avisos de ciclo de vida (docs/produto/plano-de-avisos-por-email.md): cada
// e-mail parte da situação da pessoa. Estes testes cobrem o tom por perfil,
// renovação automática × manual, cupons só nos últimos contatos, descadastro
// nos e-mails de relacionamento e as regras de reavaliação no envio.

const ctx = (over: Partial<LifecycleContext> = {}): LifecycleContext => ({
  firstName: "Fernando", persona: "professor", email: "f@escola.com.br",
  plan: "mensal", subscriptionStatus: "active", renewsAt: "2026-11-12T12:00:00Z", autoRenew: false,
  paymentMethod: "pix", cardBrand: null, cardLast4: null, nextPaymentDate: null,
  balance: 3200, hasPurchased: true, generations: 3,
  unsubscribeUrl: "https://slideai.com.br/emails/preferencias?t=x&sair=1",
  preferencesUrl: "https://slideai.com.br/emails/preferencias?t=x",
  ...over,
});

const rule = (over: Partial<RuleContext> = {}): RuleContext => ({
  ...ctx(), billingAlert: null, lastPurchaseAt: null, pendingOrderId: null,
  relationshipAllowed: true, internal: false, ...over,
});

describe("tom por perfil", () => {
  it("saudação muda com o perfil do onboarding", () => {
    expect(greeting({ firstName: "Fernando", persona: "professor" })).toBe("Olá, prof. Fernando! Tudo certo?");
    expect(greeting({ firstName: "Ana", persona: "estudante" })).toBe("Oi, Ana! Tudo bem por aí?");
    expect(greeting({ firstName: "Carla", persona: "profissional" })).toBe("Olá, Carla, tudo bem?");
    expect(greeting({ firstName: "Lucas", persona: "criador" })).toBe("E aí, Lucas! Tudo certo?");
    expect(greeting({ firstName: null, persona: "professor" })).toBe("Olá!");
  });
  it("normaliza o perfil gravado com maiúscula e ignora valores desconhecidos", () => {
    expect(normalizePersona("Professor")).toBe("professor");
    expect(normalizePersona(" estudante ")).toBe("estudante");
    expect(normalizePersona("outro")).toBeNull();
  });
  it("só usa nomes apresentáveis", () => {
    expect(firstNameOf("fernando souza")).toBe("Fernando");
    expect(firstNameOf("joao123", "maria")).toBe("Maria");
    expect(firstNameOf("x@y.com", "u_92")).toBeNull();
  });
  it("lembrete diz 'prof.' só para professor", () => {
    const prof = buildLifecycleEmail("renewal_reminder", ctx(), { days: 5 });
    expect(prof.greeting).toContain("prof. Fernando");
    expect(prof.greeting).toContain("faltam 5 dias");
    const est = buildLifecycleEmail("renewal_reminder", ctx({ persona: "estudante", firstName: "Ana" }), { days: 5 });
    expect(est.greeting).not.toContain("prof.");
  });
});

describe("renovação automática × manual", () => {
  it("rótulo da forma de pagamento", () => {
    expect(paymentLabel({ paymentMethod: "credit_card", cardBrand: "visa", cardLast4: "4323" })).toBe("Visa final 4323");
    expect(paymentLabel({ paymentMethod: "pix_automatico", cardBrand: null, cardLast4: null })).toBe("Pix Automático");
    expect(paymentLabel({ paymentMethod: "pix", cardBrand: null, cardLast4: null })).toBe("Pix");
  });
  it("cartão: 'não precisa fazer nada', botão para ver o plano", () => {
    const e = buildLifecycleEmail("renewal_reminder",
      ctx({ autoRenew: true, paymentMethod: "credit_card", cardBrand: "visa", cardLast4: "4323" }), { days: 3 });
    expect(renderText(e)).toContain("Não precisa fazer nada");
    expect(renderText(e)).toContain("Visa final 4323");
    expect(e.cta?.url).toContain("/perfil?tab=assinatura");
  });
  it("Pix: renovação manual com o link da cobrança pendente", () => {
    const e = buildLifecycleEmail("renewal_reminder",
      ctx({ pending: { kind: "pix", url: "https://pay.cakto.com.br/pix-pendente", expiresAt: null } }), { days: 5 });
    expect(renderText(e)).toContain("a renovação não é automática");
    expect(e.cta?.url).toBe("https://pay.cakto.com.br/pix-pendente");
    expect(e.cta?.label).toBe("Renovar com Pix");
  });
  it("cancelada no período: aviso de fim do acesso com reativação", () => {
    const e = buildLifecycleEmail("renewal_reminder", ctx({ subscriptionStatus: "canceled" }), { days: 3 });
    expect(e.subject).toContain("termina em 3 dias");
    expect(e.cta?.label).toBe("Reativar meu plano");
  });
});

describe("boas-vindas pela situação", () => {
  it("sem compra: chama para escolher plano ou avulso", () => {
    const e = buildLifecycleEmail("welcome", ctx({ hasPurchased: false, plan: "free", balance: 0 }));
    expect(e.cta?.label).toBe("Escolher meu plano");
    expect(e.secondary?.label).toContain("avulso");
  });
  it("com compra: chama para criar", () => {
    const e = buildLifecycleEmail("welcome", ctx());
    expect(e.cta?.label).toBe("Criar minha apresentação");
  });
});

describe("todos os modelos", () => {
  const rendered = Object.entries(SAMPLE_LIFECYCLE).map(([name, [tpl, over, data]]) => {
    const e = buildLifecycleEmail(tpl, ctx(over), data ?? {});
    return { name, tpl, e, html: renderLayout(e), text: renderText(e) };
  });

  it("cobre todos os modelos do catálogo", () => {
    const used = new Set(rendered.map((r) => r.tpl));
    expect(LIFECYCLE_TEMPLATES.filter((t) => !used.has(t))).toEqual([]);
  });

  it.each(rendered.map((r) => [r.name, r] as const))("%s renderiza sem buracos", (_n, r) => {
    expect(r.e.subject.length).toBeGreaterThan(5);
    expect(r.e.subject.length).toBeLessThanOrEqual(90);
    for (const s of [r.text, r.e.subject, r.e.preheader]) {
      expect(s).not.toMatch(/undefined|NaN|\bnull\b|\[object/);
    }
    expect(r.text).not.toMatch(/<[a-z][^>]*>/i);
    if (r.e.cta) expect(r.e.cta.url).toMatch(/^https:\/\//);
  });

  it("cupons só nos últimos contatos (nutrição D30 e reconquista D30)", () => {
    const withCoupon = rendered.filter((r) => r.text.includes(COUPONS.firstPurchase.code) || r.text.includes(COUPONS.winback.code));
    expect(withCoupon.map((r) => r.name).sort()).toEqual(["ciclo-nutricao-d30-cupom", "ciclo-reconquista-d30-cupom"]);
  });

  it("relacionamento sai em nome da Rebeca e tem descadastro; o resto não", () => {
    for (const r of rendered) {
      const rel = r.e.kind === "relationship";
      expect(r.e.from).toBe(rel ? SENDERS.relationship : SENDERS.team);
      expect(r.html.includes("Descadastrar")).toBe(rel);
    }
  });
});

describe("reavaliação no envio", () => {
  const at = "2026-10-01T12:00:00Z";
  it("nutrição para quando a pessoa compra", () => {
    expect(shouldSend("nurture", rule({ hasPurchased: false }), { day: 3 }, at)).toEqual({ send: true });
    expect(shouldSend("nurture", rule({ hasPurchased: true }), { day: 3 }, at)).toMatchObject({ send: false, reason: "purchased" });
  });
  it("relacionamento respeita descadastro e contas internas", () => {
    expect(shouldSend("nurture", rule({ hasPurchased: false, relationshipAllowed: false }), {}, at)).toMatchObject({ reason: "unsubscribed" });
    expect(shouldSend("winback", rule({ internal: true }), {}, at)).toMatchObject({ reason: "internal_account" });
  });
  it("carrinho abandonado não sai se comprou depois", () => {
    expect(shouldSend("checkout_abandoned", rule({ lastPurchaseAt: "2026-10-01T13:00:00Z" }), {}, at)).toMatchObject({ reason: "purchased" });
    expect(shouldSend("checkout_abandoned", rule({ lastPurchaseAt: "2026-09-01T13:00:00Z" }), {}, at)).toEqual({ send: true });
  });
  it("lembrete de renovação não sai se a data mudou ou o plano acabou", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const c = rule({ renewsAt: "2026-11-12T12:00:00Z" });
    expect(shouldSend("renewal_reminder", c, { due: "2026-11-12T12:00:00Z" }, at, now)).toEqual({ send: true });
    expect(shouldSend("renewal_reminder", c, { due: "2026-11-20T12:00:00Z" }, at, now)).toMatchObject({ reason: "due_changed" });
    expect(shouldSend("renewal_reminder", rule({ renewsAt: "2026-11-01T00:00:00Z" }), {}, at, now)).toMatchObject({ reason: "not_current" });
  });
  it("Pix pendente não sai depois de pago ou vencido", () => {
    const pending = { kind: "pix" as const, url: "u", expiresAt: "2026-10-01T12:30:00Z" };
    const now = new Date("2026-10-01T12:10:00Z");
    expect(shouldSend("pix_pending", rule({ pending, pendingOrderId: "o1" }), { order_id: "o1" }, at, now)).toEqual({ send: true });
    expect(shouldSend("pix_pending", rule({ pending: null }), { order_id: "o1" }, at, now)).toMatchObject({ reason: "not_pending" });
    expect(shouldSend("pix_pending", rule({ pending, pendingOrderId: "o1" }), { order_id: "o1" }, at, new Date("2026-10-01T13:00:00Z"))).toMatchObject({ reason: "expired" });
  });
  it("atraso resolvido cancela o lembrete de atraso", () => {
    expect(shouldSend("subscription_late_followup", rule({ billingAlert: null }), {}, at)).toMatchObject({ reason: "resolved" });
  });
  it("horário e frequência dos e-mails de relacionamento", () => {
    expect(nextAllowedTime(new Date("2026-10-04T15:00:00Z"))).toBeNull(); // 12 h em Brasília
    expect(nextAllowedTime(new Date("2026-10-04T10:00:00Z"))?.toISOString()).toBe("2026-10-04T12:00:00.000Z"); // 7 h → 9 h
    expect(nextAllowedTime(new Date("2026-10-05T02:00:00Z"))?.toISOString()).toBe("2026-10-05T12:00:00.000Z"); // 23 h → 9 h do dia seguinte
    expect(frequencyDelay(1, 1)).toBe(24);
    expect(frequencyDelay(0, 3)).toBe(48);
    expect(frequencyDelay(0, 2)).toBeNull();
  });
});

describe("webhook: dados de cobrança da Cakto", () => {
  const renewed = {
    data: {
      paymentMethod: "credit_card", card: { brand: "visa", lastDigits: "4323" }, checkoutUrl: "https://pay.cakto.com.br/x",
      subscription: { paymentMethod: "credit_card", next_payment_date: "2026-10-29T00:45:58.084577+00:00" },
    },
  };
  it("cartão renova sozinho e guarda os 4 últimos dígitos", () => {
    expect(billingSnapshotFrom(renewed)).toEqual({
      payment_method: "credit_card", auto_renew: true, card_brand: "visa", card_last4: "4323",
      next_payment_date: "2026-10-29T00:45:58.084Z",
    });
  });
  it("pix_automatico renova sozinho; pix comum não", () => {
    expect(billingSnapshotFrom({ data: { subscription: { paymentMethod: "pix_automatico" } } })?.auto_renew).toBe(true);
    expect(billingSnapshotFrom({ data: { subscription: { paymentMethod: "pix" } } })?.auto_renew).toBe(false);
  });
  it("compra avulsa (sem assinatura) não mexe na forma de pagamento do plano", () => {
    expect(billingSnapshotFrom({ data: { paymentMethod: "pix" } })).toBeNull();
  });
  it("Pix e boleto pendentes", () => {
    const pix = pendingChargeFrom("pix_gerado", { data: { amount: 49.9, checkoutUrl: "https://c", pix: { qrCode: "000201", expirationDate: "2026-10-04T12:30:00Z" } } });
    expect(pix).toMatchObject({ kind: "pix", pix_code: "000201", pay_url: "https://c", amount: 49.9 });
    const boleto = pendingChargeFrom("boleto_gerado", { data: { boleto: { boletoUrl: "https://b", expirationDate: "2026-10-06" } } });
    expect(boleto).toMatchObject({ kind: "boleto", pay_url: "https://b", expires_at: "2026-10-07T02:59:00.000Z" });
    expect(pendingChargeFrom("purchase_approved", {})).toBeNull();
  });
  it("alertas de cobrança ligam e desligam", () => {
    expect(billingAlertFor("subscription_renewal_refused", "ignored")).toBe("renewal_refused");
    expect(billingAlertFor("subscription_late", "ignored")).toBe("late");
    expect(billingAlertFor("subscription_renewed", "paid")).toBeNull();
    expect(billingAlertFor("pix_gerado", "ignored")).toBeUndefined();
  });
});
