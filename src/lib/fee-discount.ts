/** Fee schedule presentation only; execution fees remain server-authoritative. */
export const ETH_FEE_DISCOUNT_PERCENT = 25;

export function displayedFeeRate(
  value: number | string | null | undefined,
  ethDiscount: boolean,
): number | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const rate = Number(value);
  // Preserve maker rebates: a discount must not reduce a customer's rebate.
  return ethDiscount && rate > 0
    ? Number((rate * (1 - ETH_FEE_DISCOUNT_PERCENT / 100)).toFixed(10))
    : rate;
}