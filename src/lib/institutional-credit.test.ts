import { describe, expect, it } from "vitest";
import { creditMetrics, creditScenarioSchema, CREDIT_MAX_LTV, creditRequestBody, type CreditScenario } from "./institutional-credit";
const scenario: CreditScenario = { collateralAsset: "BTC", collateralAmount: 2, collateralPrice: 100_000, borrowingAsset: "USDT", borrowingPrice: 1, ltv: 50, rateModel: "fixed", fixedApr: 6, primeApr: 5, spread: 2 };
describe("credit simulation", () => {
  it("caps institutional scenario LTV at 70%", () => {
    expect(CREDIT_MAX_LTV).toBe(70);
    expect(creditScenarioSchema.safeParse({ ...scenario, ltv: 70 }).success).toBe(true);
    expect(creditScenarioSchema.safeParse({ ...scenario, ltv: 70.01 }).success).toBe(false);
  });
  it("values collateral and borrowing units without crediting funds", () => {
    const m = creditMetrics(scenario);
    expect(m.collateralValue).toBe(200_000);
    expect(m.principal).toBe(100_000);
    expect(m.borrowingAmount).toBe(100_000);
    expect(m.annualInterest).toBe(6_000);
  });
  it("uses assumed prime plus spread for variable scenarios", () => {
    expect(creditMetrics({ ...scenario, rateModel: "variable" }).apr).toBe(7);
  });
  it("calculates margin buffer against an illustrative 80% liquidation threshold", () => {
    const m = creditMetrics({ ...scenario, ltv: 70 });
    expect(m.downsideBuffer).toBe(12.5);
    expect(m.liquidationPrice).toBe(87_500);
  });
  it("rejects invalid amounts and same-asset borrowing", () => {
    for (const amount of [-1, 0, Infinity, NaN]) expect(creditScenarioSchema.safeParse({ ...scenario, collateralAmount: amount }).success).toBe(false);
    expect(creditScenarioSchema.safeParse({ ...scenario, borrowingAsset: "BTC" }).success).toBe(false);
  });
  it("persists scenario figures, not client approval instructions", () => {
    expect(creditRequestBody(scenario)).toContain("Indicative principal: 100000.00 USDT");
  });
});