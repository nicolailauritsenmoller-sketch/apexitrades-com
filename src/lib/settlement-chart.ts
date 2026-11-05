import type { Candle } from "./market-types";

export function settlementInterval(start: number, end: number) {
  const span = end - start;
  if (span <= 60 * 60 * 1000) return { binance: "1m", seconds: 60 };
  if (span <= 6 * 60 * 60 * 1000) return { binance: "5m", seconds: 300 };
  if (span <= 2 * 24 * 60 * 60 * 1000) return { binance: "1h", seconds: 3600 };
  return { binance: "1d", seconds: 86400 };
}

export function filterSettlementCandles(candles: Candle[], start: number, end: number, seconds: number) {
  const earliest = Math.floor(start / (seconds * 1000)) * seconds * 1000;
  return candles.filter((c) => c.t >= earliest && c.t <= end
    && [c.t, c.o, c.h, c.l, c.c].every(Number.isFinite)
    && c.l > 0 && c.h >= Math.max(c.o, c.c) && c.l <= Math.min(c.o, c.c))
    .sort((a, b) => a.t - b.t);
}