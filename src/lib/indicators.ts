import type { Candle } from "./market-types";

export type IndicatorPoint = { t: number; value?: number };
export type BollingerPoint = { t: number; upper: number; middle: number; lower: number };
export type MacdPoint = { t: number; macd: number; signal: number; histogram: number };
export type StochasticPoint = { t: number; k: number; d: number };

function safeAvg(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  return valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
}

export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < period) {
      out.push({ t: candles[i].t });
      continue;
    }
    const slice = candles.slice(i - period + 1, i + 1);
    out.push({ t: candles[i].t, value: safeAvg(slice.map((c) => c.c)) });
  }
  return out;
}

export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  const k = 2 / (period + 1);
  let prevEma: number | undefined;
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < period) {
      out.push({ t: candles[i].t });
      continue;
    }
    if (prevEma === undefined) {
      prevEma = safeAvg(candles.slice(0, period).map((c) => c.c));
      out.push({ t: candles[i].t, value: prevEma });
      continue;
    }
    const ema = candles[i].c * k + prevEma * (1 - k);
    out.push({ t: candles[i].t, value: ema });
    prevEma = ema;
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].c - candles[i - 1].c;
    if (change >= 0) gains += change;
    else losses -= change;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period; i < candles.length; i++) {
    const change = candles[i].c - candles[i - 1].c;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const value = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
    out.push({ t: candles[i].t, value });
  }
  // Pad initial bars so the arrays align with input.
  const prefix: IndicatorPoint[] = candles.slice(0, period).map((c) => ({ t: c.t }));
  return [...prefix, ...out];
}

export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const fastEma = ema(candles, fast).map((p) => p.value ?? NaN);
  const slowEma = ema(candles, slow).map((p) => p.value ?? NaN);
  const macdLine: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    macdLine.push(Number.isFinite(fastEma[i]) && Number.isFinite(slowEma[i])
      ? fastEma[i] - slowEma[i]
      : NaN);
  }
  // EMA of MACD line for signal.
  const k = 2 / (signalPeriod + 1);
  let signalEma: number | undefined;
  const signal: number[] = [];
  let validCount = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (!Number.isFinite(macdLine[i])) {
      signal.push(NaN);
      continue;
    }
    validCount++;
    if (signalEma === undefined) {
      // Simple average of first signalPeriod valid values.
      const slice = macdLine.slice(0, i + 1).filter(Number.isFinite);
      signalEma = slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : 0;
    } else {
      signalEma = macdLine[i] * k + signalEma * (1 - k);
    }
    signal.push(signalEma);
  }

  const out: MacdPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const m = macdLine[i];
    const s = signal[i];
    out.push({
      t: candles[i].t,
      macd: Number.isFinite(m) ? m : 0,
      signal: Number.isFinite(s) ? s : 0,
      histogram: Number.isFinite(m) && Number.isFinite(s) ? m - s : 0,
    });
  }
  return out;
}

export function bollinger(candles: Candle[], period = 20, multiplier = 2): BollingerPoint[] {
  const middle = sma(candles, period).map((p) => p.value ?? NaN);
  const out: BollingerPoint[] = [];
  for (let i = 0; i < candles.length; i++) {
    const mid = middle[i];
    if (!Number.isFinite(mid)) {
      out.push({ t: candles[i].t, upper: 0, middle: 0, lower: 0 });
      continue;
    }
    const slice = candles.slice(Math.max(0, i - period + 1), i + 1).map((c) => c.c);
    const mean = safeAvg(slice);
    const variance = safeAvg(slice.map((c) => Math.pow(c - mean, 2)));
    const std = Math.sqrt(variance);
    out.push({
      t: candles[i].t,
      upper: mid + multiplier * std,
      middle: mid,
      lower: mid - multiplier * std,
    });
  }
  return out;
}

export function vwap(candles: Candle[]): IndicatorPoint[] {
  let cumTPV = 0;
  let cumVol = 0;
  const out: IndicatorPoint[] = [];
  for (const c of candles) {
    const v = c.v ?? 0;
    if (v > 0) {
      const typical = (c.h + c.l + c.c) / 3;
      cumTPV += typical * v;
      cumVol += v;
      out.push({ t: c.t, value: cumTPV / cumVol });
    } else {
      out.push({ t: c.t, value: cumVol > 0 ? cumTPV / cumVol : c.c });
    }
  }
  return out;
}

export function stochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3,
): StochasticPoint[] {
  const out: StochasticPoint[] = [];
  const kValues: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i + 1 < kPeriod) {
      out.push({ t: candles[i].t, k: 0, d: 0 });
      continue;
    }
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const lowest = Math.min(...slice.map((c) => c.l));
    const highest = Math.max(...slice.map((c) => c.h));
    const range = highest - lowest;
    const k = range === 0 ? 50 : ((candles[i].c - lowest) / range) * 100;
    kValues.push(k);
    const d =
      kValues.length >= dPeriod
        ? safeAvg(kValues.slice(kValues.length - dPeriod))
        : safeAvg(kValues);
    out.push({ t: candles[i].t, k, d });
  }
  return out;
}

export function atr(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  const trs: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const prev = i > 0 ? candles[i - 1].c : c.o;
    const tr = Math.max(c.h - c.l, Math.abs(c.h - prev), Math.abs(c.l - prev));
    trs.push(tr);
    if (i + 1 < period) {
      out.push({ t: c.t });
      continue;
    }
    const slice = trs.slice(i - period + 1, i + 1);
    out.push({ t: c.t, value: safeAvg(slice) });
  }
  return out;
}

export function heikinAshi(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  let prevHA: Candle | undefined;
  for (const c of candles) {
    const haClose = (c.o + c.h + c.l + c.c) / 4;
    const haOpen = prevHA ? (prevHA.o + prevHA.c) / 2 : (c.o + c.c) / 2;
    const haHigh = Math.max(c.h, haOpen, haClose);
    const haLow = Math.min(c.l, haOpen, haClose);
    const ha: Candle = { t: c.t, o: haOpen, h: haHigh, l: haLow, c: haClose, v: c.v };
    out.push(ha);
    prevHA = ha;
  }
  return out;
}
