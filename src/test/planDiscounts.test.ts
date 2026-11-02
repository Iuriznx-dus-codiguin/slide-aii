import { describe, expect, it } from "vitest";
import { maximumProDiscountPct, proCycleDiscountLabel } from "@/lib/planDiscounts";

describe("pricing discount comparisons", () => {
  it("separates the quarterly PRO reduction from cycle savings", () => {
    expect(proCycleDiscountLabel("trimestral")).toBe("PRO 30% OFF · ciclo 15% OFF");
  });
  it("does not advertise 64 percent when the actual maximum is 54", () => {
    expect(maximumProDiscountPct()).toBe(54);
  });
});