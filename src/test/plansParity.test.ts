import { describe, expect, it } from "vitest";
import * as app from "../lib/cakto";
import * as fn from "../../supabase/functions/_shared/plans.ts";

// Os e-mails (edge functions) usam uma cópia dos planos: preço, créditos e
// link de checkout precisam ser os mesmos que o app mostra e cobra.
describe("planos: app × edge functions", () => {
  it("links de checkout, rótulos, preços e créditos são iguais", () => {
    for (const p of Object.keys(fn.CHECKOUT_URLS) as fn.PaidPlan[]) {
      expect(fn.CHECKOUT_URLS[p], p).toBe(app.CHECKOUT_URLS[p]);
      expect(fn.PLAN_PRICES[p], p).toBe(app.PLAN_PRICES[p]);
      expect(fn.PLAN_LABELS[p], p).toBe(app.PLAN_LABELS[p]);
    }
    expect(fn.PLAN_MONTHLY_CREDITS).toEqual(app.PLAN_MONTHLY_CREDITS);
    expect(fn.PLAN_SIGNUP_BONUS).toEqual(app.PLAN_SIGNUP_BONUS);
    expect(fn.SINGLE_PURCHASE_CREDITS).toBe(app.SINGLE_PURCHASE_CREDITS);
  });
});
