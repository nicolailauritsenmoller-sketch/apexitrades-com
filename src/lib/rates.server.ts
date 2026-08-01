import { fetchPrice } from "./market.server";

export const SWAP_CURRENCIES = ["USD", "EUR", "GBP", "USDT", "BTC"] as const;
export type SwapCurrency = (typeof SWAP_CURRENCIES)[number];

/**
 * USDT value of one unit of each supported wallet currency.
 * USD is treated as 1:1 with USDT.
 */
export async function usdtRates(): Promise<Record<string, number>> {
  const rates: Record<string, number> = { USD: 1, USDT: 1 };

  const [eur, gbp, btc] = await Promise.all([
    fetchPrice("EURUSD=X").catch(() => 1.08),
    fetchPrice("GBPUSD=X").catch(() => 1.27),
    fetchPrice("BTCUSDT").catch(() => 0),
  ]);

  rates["EUR"] = eur;
  rates["GBP"] = gbp;
  rates["BTC"] = btc;
  return rates;
}
