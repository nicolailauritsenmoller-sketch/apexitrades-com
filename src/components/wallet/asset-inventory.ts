import type { AssetHolding } from "@/components/AssetsOverview";

export const STANDARD_WALLET_ASSETS = ["USDT", "BTC", "ETH", "SOL", "XRP", "BNB"] as const;

// Illustrative inventory only. Never pass these quantities to transaction forms.
const SAMPLES: Record<string, { balance: number; rate: number }> = {
  USDT: { balance: 12500, rate: 1 },
  BTC: { balance: 0.125, rate: 68000 },
  ETH: { balance: 1.8, rate: 3500 },
  SOL: { balance: 24, rate: 150 },
  XRP: { balance: 1500, rate: 0.6 },
  BNB: { balance: 0, rate: 600 },
};

export function assetInventory(holdings: AssetHolding[], sample = false): AssetHolding[] {
  const existing = new Map(holdings.map((holding) => [holding.currency, holding]));
  const currencies = [...new Set([...STANDARD_WALLET_ASSETS, ...existing.keys()])];
  return currencies.map((currency) => {
    const demo = sample ? SAMPLES[currency] : undefined;
    if (demo) return { currency, ...demo, valueUsdt: demo.balance * demo.rate };
    return existing.get(currency) ?? { currency, balance: 0, available: 0, rate: 0, valueUsdt: 0 };
  });
}

export function filterInventory(holdings: AssetHolding[], hideZero: boolean): AssetHolding[] {
  return hideZero ? holdings.filter((holding) => holding.balance > 0) : holdings;
}