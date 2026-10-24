import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as app from "../lib/cakto";
import * as fn from "../../supabase/functions/_shared/plans.ts";
import * as webhook from "../../supabase/functions/cakto-webhook/lib.ts";

const PAID = Object.keys(app.PLAN_PRICE_CENTS) as app.PaidPlan[];

// Os e-mails (edge functions) usam uma cópia dos planos: preço, créditos e
// link de checkout precisam ser os mesmos que o app mostra e cobra.
describe("planos: app × edge functions", () => {
  it("links de checkout, rótulos, preços e créditos são iguais", () => {
    for (const p of Object.keys(fn.CHECKOUT_URLS) as fn.PaidPlan[]) {
      expect(fn.CHECKOUT_URLS[p], p).toBe(app.CHECKOUT_URLS[p]);
      expect(fn.PLAN_PRICE_CENTS[p], p).toBe(app.PLAN_PRICE_CENTS[p]);
      expect(fn.PLAN_PRICES[p], p).toBe(app.PLAN_PRICES[p]);
      expect(fn.PLAN_LABELS[p], p).toBe(app.PLAN_LABELS[p]);
    }
    expect(fn.PLAN_MONTHLY_CREDITS).toEqual(app.PLAN_MONTHLY_CREDITS);
    expect(webhook.PLAN_MONTHLY_CREDITS).toEqual(app.PLAN_MONTHLY_CREDITS);
    expect(fn.SINGLE_PURCHASE_CREDITS).toBe(app.SINGLE_PURCHASE_CREDITS);
    expect(webhook.SINGLE_PURCHASE_CREDITS).toBe(app.SINGLE_PURCHASE_CREDITS);
    expect(fn.MAX_USAGE_MULTIPLIER).toBe(app.MAX_USAGE_MULTIPLIER);
    expect(fn.REFERENCE_DECK_CREDITS).toBe(app.REFERENCE_DECK_CREDITS);
  });

  it("o custo da geração cobrado no servidor é o mesmo exibido na tela", () => {
    expect(fn.CREDITS_PER_SLIDE).toBe(app.CREDITS_PER_SLIDE);
    expect(fn.DEPTH_CREDITS).toEqual(app.DEPTH_CREDITS);
    expect(fn.SPEECHES_CREDITS).toBe(app.SPEECHES_CREDITS);
    for (const slides of [0, 3, 5, 8, 10, 12.4, 20, 25]) {
      for (const depth of ["short", "balanced", "long", "desconhecida"]) {
        for (const speeches of [false, true]) {
          expect(fn.computeCreditsCost({ slidesCount: slides, textDepth: depth, includeSpeeches: speeches }), `${slides}/${depth}/${speeches}`)
            .toBe(app.estimateCreditsCost(slides, depth, speeches));
        }
      }
    }
  });

  it("a cota mensal do banco (plan_monthly_credits, migração mais recente) é a do código", () => {
    // A renovação preguiçosa e can_user_generate usam a função SQL; o webhook
    // e a tela usam as constantes. Os dois lados precisam bater.
    const dir = "drizzle/migrations";
    const latest = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
      .map((f) => readFileSync(`${dir}/${f}`, "utf8"))
      .filter((sql) => /FUNCTION public\.plan_monthly_credits/.test(sql))
      .pop();
    expect(latest, "nenhuma migração em drizzle/ define plan_monthly_credits").toBeTruthy();
    const pro = latest!.match(/'mensal','trimestral','anual'\) THEN (\d+)/)?.[1];
    const max = latest!.match(/'max_mensal','max_trimestral','max_anual'\) THEN (\d+)/)?.[1];
    expect(Number(pro)).toBe(app.PLAN_MONTHLY_CREDITS.mensal);
    expect(Number(max)).toBe(app.PLAN_MONTHLY_CREDITS.max_mensal);
  });
});

describe("tabela de planos (10/2026)", () => {
  it("PRO rende 10 apresentações de referência por mês e o MAX, 5 vezes o PRO", () => {
    expect(app.REFERENCE_DECK_CREDITS).toBe(170);
    for (const p of ["mensal", "trimestral", "anual"]) expect(app.PLAN_MONTHLY_CREDITS[p], p).toBe(1700);
    for (const p of ["max_mensal", "max_trimestral", "max_anual"]) expect(app.PLAN_MONTHLY_CREDITS[p], p).toBe(8500);
    expect(app.estimatedDecks(app.PLAN_MONTHLY_CREDITS.mensal)).toBe(10);
    expect(app.MAX_USAGE_MULTIPLIER).toBe(5);
    expect(app.estimatedDecks(app.PLAN_MONTHLY_CREDITS.max_mensal)).toBe(50);
    // A compra avulsa não mudou e segue divulgada como ≈ 3 apresentações.
    expect(app.SINGLE_PURCHASE_CREDITS).toBe(500);
    expect(app.estimatedDecks(app.SINGLE_PURCHASE_CREDITS)).toBe(3);
  });

  it("créditos sempre redondos (múltiplos de 100)", () => {
    for (const [p, c] of Object.entries(app.PLAN_MONTHLY_CREDITS)) expect(c % 100, p).toBe(0);
    expect(app.SINGLE_PURCHASE_CREDITS % 100).toBe(0);
  });

  it("preços da tabela", () => {
    expect(app.PLAN_PRICES).toEqual({
      single: "R$ 14,90",
      mensal: "R$ 34,90/mês",
      trimestral: "R$ 88,90/trimestre",
      anual: "R$ 276,90/ano",
      max_mensal: "R$ 147,00/mês",
      max_trimestral: "R$ 375,00/trimestre",
      max_anual: "R$ 1.164,00/ano",
    });
    expect(app.monthlyEquivalent("trimestral", "trimestral")).toBe("29,63");
    expect(app.monthlyEquivalent("anual", "anual")).toBe("23,08");
    expect(app.monthlyEquivalent("max_trimestral", "trimestral")).toBe("125,00");
    expect(app.monthlyEquivalent("max_anual", "anual")).toBe("97,00");
  });

  it("desconto proporcional: PRO e MAX têm o mesmo desconto em cada ciclo", () => {
    // O seletor de ciclo é um só para os dois planos, com um selo só.
    expect(app.cycleDiscountPct("trimestral", "trimestral")).toBe(15);
    expect(app.cycleDiscountPct("max_trimestral", "trimestral")).toBe(15);
    expect(app.cycleDiscountPct("anual", "anual")).toBe(34);
    expect(app.cycleDiscountPct("max_anual", "anual")).toBe(34);
    expect(fn.cycleDiscountPct("trimestral")).toBe(15);
    expect(fn.cycleDiscountPct("max_anual")).toBe(34);
  });

  it("toda assinatura mostra desconto do preço anterior para o atual; o avulso fica intacto", () => {
    for (const p of PAID.filter((x) => x !== "single")) {
      const before = app.PLAN_PREVIOUS_PRICE_CENTS[p];
      expect(before, p).toBeTruthy();
      expect(app.PLAN_PRICE_CENTS[p], p).toBeLessThan(before!);
    }
    expect(app.PLAN_PREVIOUS_PRICE_CENTS.single).toBeUndefined();
    expect(app.PLAN_PRICE_CENTS.single).toBe(1490);
    expect(app.previousPriceDiscountPct("mensal")).toBe(30);
    expect(app.previousPriceDiscountPct("anual")).toBe(30);
  });
});
