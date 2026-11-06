import { z } from "zod";

export const CREDIT_MAX_LTV = 70;
export const CREDIT_LIQUIDATION_LTV = 80;
export const creditScenarioSchema = z.object({
  collateralAsset: z.enum(["BTC", "ETH", "USDT"]),
  collateralAmount: z.number().finite().positive().max(1_000_000_000),
  borrowingAsset: z.enum(["USDT", "USDC", "BTC", "ETH"]),
  collateralPrice: z.number().finite().positive().max(10_000_000),
  borrowingPrice: z.number().finite().positive().max(10_000_000),
  ltv: z.number().finite().min(10).max(CREDIT_MAX_LTV),
  rateModel: z.enum(["fixed", "variable"]),
  fixedApr: z.number().finite().min(0).max(50),
  primeApr: z.number().finite().min(0).max(50),
  spread: z.number().finite().min(0).max(20),
}).refine(d => d.collateralAsset !== d.borrowingAsset, { message: "Choose a different borrowing asset.", path: ["borrowingAsset"] });
export type CreditScenario = z.infer<typeof creditScenarioSchema>;

export function creditMetrics(input: CreditScenario) {
  const d = creditScenarioSchema.parse(input);
  const collateralValue = d.collateralAmount * d.collateralPrice;
  const principal = collateralValue * d.ltv / 100;
  const apr = d.rateModel === "fixed" ? d.fixedApr : d.primeApr + d.spread;
  return { collateralValue, principal, borrowingAmount: principal / d.borrowingPrice, apr,
    annualInterest: principal * apr / 100, dailyInterest: principal * apr / 100 / 365,
    healthFactor: CREDIT_LIQUIDATION_LTV / d.ltv,
    downsideBuffer: (1 - d.ltv / CREDIT_LIQUIDATION_LTV) * 100,
    liquidationPrice: d.collateralPrice * d.ltv / CREDIT_LIQUIDATION_LTV };
}

export function creditRequestBody(input: CreditScenario) {
  const d = creditScenarioSchema.parse(input);
  const m = creditMetrics(d);
  return ["Treasury Operations - credit facility simulation", "NON-EXECUTING: no collateral locked, credit approved or funds transferred.",
    `Collateral scenario: ${d.collateralAmount} ${d.collateralAsset}; indicative price ${d.collateralPrice} USDT`,
    `Borrowing asset: ${d.borrowingAsset}; indicative price ${d.borrowingPrice} USDT`,
    `LTV: ${d.ltv}%; simulated liquidation LTV: ${CREDIT_LIQUIDATION_LTV}%`,
    `Rate model: ${d.rateModel}; illustrative APR: ${m.apr}% (fixed ${d.fixedApr}%, assumed prime ${d.primeApr}% + spread ${d.spread}%)`,
    `Indicative principal: ${m.principal.toFixed(2)} USDT; ${m.borrowingAmount.toFixed(8)} ${d.borrowingAsset}`,
    "Prices are client-observed scenario references, not approved execution quotes. Treasury review and separately approved terms are required."].join("\n");
}