import { parseAlphaTokens, parseAlphaCandles, type AlphaFeed } from "./alpha";
const BASE = "https://www.binance.com/bapi/defi/v1/public/";
let cache: AlphaFeed | null = null;
let inflight: Promise<AlphaFeed> | null = null;
async function json(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Alpha provider unavailable");
  const data = await response.json() as { code?: string; data?: unknown };
  if (data.code !== "000000") throw new Error("Alpha provider unavailable");
  return data.data;
}

export async function fetchAlpha(): Promise<AlphaFeed> {
  if (cache && Date.now() - cache.asOf < 20_000) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const data = await json(`${BASE}wallet-direct/buw/wallet/cex/alpha/all/token/list`);
      const asOf = Date.now(), rows = parseAlphaTokens(data, asOf);
      if (!rows.length) throw new Error("Empty provider feed");
      cache = { rows, asOf, unavailable: false };
      return cache;
    } catch { return { rows: [], asOf: Date.now(), unavailable: true }; }
    finally { inflight = null; }
  })();
  return inflight;
}

let exchangeCache: { at: number; symbols: { symbol: string; baseAsset: string; quoteAsset: string; status: string }[] } | null = null;
export async function fetchAlphaChart(tokenId: string, interval: string) {
  const feed = await fetchAlpha();
  const token = feed.rows.find(r => r.tokenId === tokenId);
  if (!token) return { candles: [], quote: "USD", unavailable: true };
  try {
    if (!exchangeCache || Date.now() - exchangeCache.at > 300_000) {
      const data = await json(`${BASE}alpha-trade/get-exchange-info`) as { symbols?: { symbol: string; baseAsset: string; quoteAsset: string; status: string }[] };
      exchangeCache = { at: Date.now(), symbols: data.symbols ?? [] };
    }
    const pairs = exchangeCache.symbols.filter(s => s.baseAsset === token.alphaId && s.status === "TRADING");
    const pair = pairs.find(s => s.quoteAsset === "USDT") ?? pairs.find(s => s.quoteAsset === "USDC");
    if (!pair) return { candles: [], quote: "USD", unavailable: true };
    const data = await json(`${BASE}alpha-trade/klines?symbol=${encodeURIComponent(pair.symbol)}&interval=${interval}&limit=80`);
    const candles = parseAlphaCandles(data, Date.now());
    return { candles, quote: pair.quoteAsset, unavailable: !candles.length };
  } catch { return { candles: [], quote: "USD", unavailable: true }; }
}