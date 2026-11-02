import { CYCLE_MONTHS, PLAN_PREVIOUS_PRICE_CENTS, PLAN_PRICE_CENTS, cycleDiscountPct, previousPriceDiscountPct, proPlanFor, type BillingCycle } from "@/lib/cakto";

/** Separate comparisons: current PRO reduction and saving against current monthly billing. */
export const proCycleDiscountLabel = (cycle: BillingCycle): string => {
  const reduction = previousPriceDiscountPct(proPlanFor(cycle));
  const saving = cycleDiscountPct(proPlanFor(cycle), cycle);
  return saving > 0 ? `PRO ${reduction}% OFF · ciclo ${saving}% OFF` : `PRO ${reduction}% OFF`;
};

/** Total saving compared with the previous monthly PRO price over the same period. */
export const maximumProDiscountPct = (): number => {
  const previousMonthly = PLAN_PREVIOUS_PRICE_CENTS.mensal;
  if (!previousMonthly) return 0;
  return Math.max(...(["mensal", "trimestral", "anual"] as BillingCycle[]).map(cycle =>
    Math.round((1 - PLAN_PRICE_CENTS[proPlanFor(cycle)] / (previousMonthly * CYCLE_MONTHS[cycle])) * 100),
  ));
};