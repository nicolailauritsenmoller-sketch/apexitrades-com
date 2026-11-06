/** Membership architecture; approval and financial fees remain server-authoritative. */
export const PRIME_TIERS = [
  { level: 1, name: "Retail Prime (Tier 1)", threshold: 10_000 },
  { level: 2, name: "Institutional Select (Tier 2)", threshold: 20_000 },
  { level: 3, name: "Primary Liquidity Provider (Tier 3)", threshold: 50_000 },
  { level: 4, name: "Market Maker Prime", threshold: 100_000 },
] as const;

export function collateralProgress(balance: number, threshold: number) {
  const cleared = Number.isFinite(balance) ? Math.max(0, balance) : 0;
  return { qualified: cleared >= threshold, remaining: Math.max(0, threshold - cleared), percent: Math.min(100, (cleared / threshold) * 100) };
}

/** Stored fee rates are percentages; one percent equals 100 basis points. */
export function feeBps(rate: number | string | null | undefined) {
  if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return "Not configured";
  const value = Number(rate) * 100;
  return `${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 4 })} bps ${value < 0 ? "rebate" : "fee"}`;
}