import { fetchPrice } from "./market.server";
import { parseDisplayFx } from "./display-currency-values";

let fxCache: { at: number; rates: Record<string, number> } | null = null;
async function fallbackFx() {
  if (fxCache && Date.now() - fxCache.at < 300_000) return fxCache.rates;
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return {};
    const rates = parseDisplayFx(await response.json(), Date.now());
    fxCache = { at: Date.now(), rates };
    return rates;
  } catch { return {}; }
}

export async function fetchDisplayRates(): Promise<Record<string, number>> {
  const [eur, gbp, usdCad, btc, fallback] = await Promise.all([
    fetchPrice("EURUSD=X").catch(() => 0), fetchPrice("GBPUSD=X").catch(() => 0),
    fetchPrice("USDCAD=X").catch(() => 0), fetchPrice("BTCUSDT").catch(() => 0),
    fallbackFx(),
  ]);
  return { ...fallback, USD: 1, USDT: 1, EUR: eur || fallback.EUR || 0, GBP: gbp || fallback.GBP || 0,
    CAD: usdCad > 0 ? 1 / usdCad : fallback.CAD || 0, BTC: btc };
}