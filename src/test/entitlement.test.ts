import { describe, expect, it } from "vitest";
import { decideEntitlement, isSubscriptionCurrent, nextMonthlyReset } from "../lib/entitlement";

// Mesmos cenários do teste SQL de can_user_generate (migração 0003): a
// interface precisa decidir igual ao banco, que é quem autoriza e cobra.
const now = new Date("2026-09-27T12:00:00Z");
const future = "2026-10-07T12:00:00Z";
const past = "2026-09-26T12:00:00Z";
const today = "2026-09-27";

describe("isSubscriptionCurrent — assinatura que dá direito à cota", () => {
  it("ativa dentro do período", () => {
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: "active", subscription_renews_at: future }, now)).toBe(true);
  });
  it("cancelada continua valendo até o fim do período pago (Termos, seção 7)", () => {
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: "canceled", subscription_renews_at: future }, now)).toBe(true);
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: "canceled", subscription_renews_at: past }, now)).toBe(false);
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: "canceled", subscription_renews_at: null }, now)).toBe(false);
  });
  it("vencida, inadimplente ou sem assinatura não valem", () => {
    expect(isSubscriptionCurrent({ plan: "anual", subscription_status: "active", subscription_renews_at: past }, now)).toBe(false);
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: "past_due", subscription_renews_at: future }, now)).toBe(false);
    expect(isSubscriptionCurrent({ plan: "single" }, now)).toBe(false);
  });
  it("legado sem status nem data de renovação conta como ativa", () => {
    expect(isSubscriptionCurrent({ plan: "mensal", subscription_status: null, subscription_renews_at: null }, now)).toBe(true);
  });
});

describe("decideEntitlement — espelho de can_user_generate", () => {
  it("PRO ativa libera com a cota do ciclo", () => {
    const d = decideEntitlement(
      { plan: "mensal", subscription_status: "active", subscription_renews_at: future, credits_monthly: 1000, credits_cycle_anchor: today },
      { cost: 120, now },
    );
    expect(d).toMatchObject({ allowed: true, reason: "subscription", credits_available: 1000, access_until: null, subscription_current: true });
  });

  it("cancelada no período libera e informa até quando", () => {
    const d = decideEntitlement(
      { plan: "mensal", subscription_status: "canceled", subscription_renews_at: future, credits_monthly: 1000, credits_cycle_anchor: today },
      { cost: 120, now },
    );
    expect(d).toMatchObject({ allowed: true, reason: "subscription", access_until: future });
  });

  it("cancelada e encerrada: só o bônus vale (a sobra mensal não)", () => {
    const p = { plan: "mensal", subscription_status: "canceled", subscription_renews_at: past, credits_bonus: 500, credits_monthly: 1000, credits_cycle_anchor: "2026-08-18" };
    expect(decideEntitlement(p, { cost: 120, now })).toMatchObject({ allowed: true, reason: "bonus_only", credits_available: 500, credits_monthly: 0, monthly_allowance: 0 });
    expect(decideEntitlement(p, { cost: 600, now })).toMatchObject({ allowed: false, reason: "subscription_canceled" });
  });

  it("vencida: bônus permanente continua utilizável", () => {
    const p = { plan: "anual", subscription_status: "active", subscription_renews_at: past, credits_bonus: 300, credits_monthly: 1000, credits_cycle_anchor: "2026-07-19" };
    expect(decideEntitlement(p, { cost: 120, now }).reason).toBe("bonus_only");
    expect(decideEntitlement(p, { cost: 400, now }).reason).toBe("subscription_expired");
  });

  it("MAX no teto do uso justo recebe fair_use_limit, nunca system_error", () => {
    const p = { plan: "max_mensal", subscription_status: "active", subscription_renews_at: future, credits_monthly: 0, credits_cycle_anchor: "2026-09-24" };
    expect(decideEntitlement(p, { cost: 120, now })).toMatchObject({ allowed: false, reason: "fair_use_limit", unlimited: true });
    expect(decideEntitlement(p, { cost: 0, now }).allowed).toBe(true);
  });

  it("MAX cancelada no período usa o bônus", () => {
    const p = { plan: "max_anual", subscription_status: "canceled", subscription_renews_at: "2027-01-05T00:00:00Z", credits_bonus: 500, credits_monthly: 0, credits_cycle_anchor: "2026-09-24" };
    expect(decideEntitlement(p, { cost: 120, now })).toMatchObject({ allowed: true, reason: "subscription", unlimited: true });
  });

  it("sem plano: bônus libera, bônus curto pede compra, nada pede plano", () => {
    expect(decideEntitlement({ plan: "free", credits_bonus: 500 }, { cost: 120, now }).reason).toBe("bonus_only");
    expect(decideEntitlement({ plan: "free", credits_bonus: 50 }, { cost: 120, now }).reason).toBe("insufficient_credits");
    expect(decideEntitlement({ plan: "free", credits_bonus: 0 }, { cost: 120, now }).reason).toBe("no_plan");
    expect(decideEntitlement(null, { cost: 1, now }).reason).toBe("no_plan");
  });

  it("avulso", () => {
    expect(decideEntitlement({ plan: "single", credits_bonus: 500 }, { cost: 120, now }).reason).toBe("single");
    expect(decideEntitlement({ plan: "single", credits_bonus: 50 }, { cost: 120, now }).reason).toBe("insufficient_credits");
  });

  it("trimestral cancelada no período com ciclo vencido mostra a cota cheia", () => {
    const d = decideEntitlement(
      { plan: "trimestral", subscription_status: "canceled", subscription_renews_at: "2026-11-06T00:00:00Z", credits_bonus: 100, credits_monthly: 5, credits_cycle_anchor: "2026-07-27" },
      { cost: 120, now },
    );
    expect(d).toMatchObject({ allowed: true, credits_available: 3300 });
  });

  it("inadimplente não usa a cota", () => {
    const d = decideEntitlement({ plan: "mensal", subscription_status: "past_due", subscription_renews_at: future, credits_monthly: 800 }, { cost: 120, now });
    expect(d.reason).toBe("subscription_expired");
  });

  it("desenvolvedor sempre liberado", () => {
    expect(decideEntitlement({ plan: "free" }, { cost: 120, now, isDeveloper: true })).toMatchObject({ allowed: true, reason: "dev" });
  });

  it("a interface usa custo 1: saldo zerado não libera", () => {
    const p = { plan: "mensal", subscription_status: "active", subscription_renews_at: future, credits_monthly: 0, credits_cycle_anchor: today };
    expect(decideEntitlement(p, { cost: 1, now }).reason).toBe("insufficient_credits");
  });
});

describe("nextMonthlyReset", () => {
  it("um mês depois da âncora, com o corte do fim do mês", () => {
    expect(nextMonthlyReset("2026-09-24")).toBe("24/10/2026");
    expect(nextMonthlyReset("2026-01-31")).toBe("28/02/2026");
    expect(nextMonthlyReset(null)).toBeNull();
  });
});
