import type { AssetHolding } from "@/components/AssetsOverview";

export const STANDARD_WALLET_ASSETS = ["USDT", "BTC", "ETH", "SOL", "XRP", "BNB"] as const;

export function assetInventory(holdings: AssetHolding[]): AssetHolding[] {
  const existing = new Map(holdings.map((holding) => [holding.currency, holding]));
  const currencies = [...new Set([...STANDARD_WALLET_ASSETS, ...existing.keys()])];
  return currencies.map(
    (currency) => existing.get(currency) ?? { currency, balance: 0, available: 0, rate: 0, valueUsdt: 0 },
  );
}

export function filterInventory(holdings: AssetHolding[], hideZero: boolean): AssetHolding[] {
  return hideZero ? holdings.filter((holding) => holding.balance > 0) : holdings;
}
