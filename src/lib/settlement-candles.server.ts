import { INSTRUMENT_MAP } from "./instruments";
import type { Candle } from "./market-types";

/** Historical provider candles only, never the live chart's synthetic fallback. */
export async function fetchSettlementCandles(symbol: string, start: number, end: number): Promise<Candle[]> {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) return [];
  const intervalSeconds = end - start <= 3600 ? 60 : end - start <= 86400 ? 300 : 3600;
  const floor = Math.floor(start / intervalSeconds) * intervalSeconds;
  const urls = inst.source === "binance"
    ? ["https://api.binance.com", "https://data-api.binance.vision"].map((host) => `${host}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${intervalSeconds === 60 ? "1m" : intervalSeconds === 300 ? "5m" : "1h"}&startTime=${floor * 1000}&endTime=${end * 1000}&limit=1000`)
    : ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"].map((host) => `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${intervalSeconds === 60 ? "1m" : intervalSeconds === 300 ? "5m" : "1h"}&period1=${floor}&period2=${end + intervalSeconds}`);
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) continue;
      const data = await response.json();
      let candles: Candle[];
      if (inst.source === "binance") {
        if (!Array.isArray(data)) continue;
        candles = data.map((r) => ({ t: Number(r[0]) / 1000, o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) }));
      } else {
        const result = data?.chart?.result?.[0];
        const quote = result?.indicators?.quote?.[0];
        candles = (result?.timestamp ?? []).map((t: number, i: number) => ({ t, o: quote?.open?.[i], h: quote?.high?.[i], l: quote?.low?.[i], c: quote?.close?.[i] }));
      }
      const valid = candles.filter((c) => c.t >= floor && c.t <= end && [c.t, c.o, c.h, c.l, c.c].every(Number.isFinite) && c.l > 0 && c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c));
      if (valid.length) return valid;
    } catch { /* provider fallback */ }
  }
  return [];
}