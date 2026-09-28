import { fetchPrice } from "./market.server";
import { INSTRUMENT_MAP } from "./instruments";

export const SWAP_CURRENCIES = ["USD", "EUR", "GBP", "USDT", "BTC", "ETH"] as const;
export type SwapCurrency = (typeof SWAP_CURRENCIES)[number];

/**
 * USDT value of one unit of each supported wallet currency.
 * USD is treated as 1:1 with USDT.
 */
export async function usdtRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = { USD: 1, USDT: 1 };

  const [eur, gbp, btc, eth] = await Promise.all([
    fetchPrice("EURUSD=X").catch(() => 1.08),
    fetchPrice("GBPUSD=X").catch(() => 1.27),
    fetchPrice("BTCUSDT").catch(() => 0),
    fetchPrice("ETHUSDT").catch(() => 0),
  ]);

  rates["EUR"] = eur;
  rates["GBP"] = gbp;
  rates["BTC"] = btc;
  rates["ETH"] = eth;
  return rates;
}

/** USD value of one unit of a fiat currency code (USD == 1). */
async function fiatUsdValue(code: string): Promise<number> {
  if (code === "USD" || code === "USDT") return 1;
  const direct = await fetchPrice(`${code}USD=X`).catch(() => 0);
  if (direct > 0) return direct;
  const inverse = await fetchPrice(`USD${code}=X`).catch(() => 0);
  return inverse > 0 ? 1 / inverse : 0;
}

/**
 * USDT value of one unit of any tradable asset code - a wallet currency
 * (USD, EUR, GBP, USDT, BTC) or an instrument symbol (AAPL, GC=F, EURUSD=X…).
 */
export async function assetUsdtRate(code: string): Promise<number> {
  const upper = code.toUpperCase();
  if (upper === "USD" || upper === "USDT") return 1;

  const instrument = INSTRUMENT_MAP[upper];
  if (instrument) {
    if (instrument.assetClass === "forex") {
      // A forex "holding" is one unit of the pair's base currency.
      const base = upper.replace("=X", "").slice(0, 3);
      return fiatUsdValue(base);
    }
    const price = await fetchPrice(upper).catch(() => 0);
    return price;
  }

  // Plain fiat/crypto wallet code that is not an instrument symbol.
  const crypto = await fetchPrice(`${upper}USDT`).catch(() => 0);
  if (crypto > 0) return crypto;
  return fiatUsdValue(upper);
}

/** Batched {@link assetUsdtRate} for a list of asset codes. */
export async function assetUsdtRates(codes: string[]): Promise<Record<string, number>> {
  const unique = [...new Set(codes.map((c) => c.toUpperCase()))];
  const values = await Promise.all(unique.map((c) => assetUsdtRate(c).catch(() => 0)));
  const out: Record<string, number> = {};
  unique.forEach((code, i) => {
    out[code] = values[i] ?? 0;
  });
  return out;
}
