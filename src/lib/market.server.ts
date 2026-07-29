/**
 * Server-only market data adapters.
 * Crypto quotes/candles come from Binance public endpoints; everything else
 * (stocks, futures, forex, metals) comes from the Yahoo Finance chart API.
 */
import { INSTRUMENT_MAP, type Instrument } from "./instruments";

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  previousClose: number;
  currency: string;
  stale: boolean;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

export type Timeframe = "1m" | "5m" | "15m" | "1h" | "1d";

const YAHOO_RANGE: Record<Timeframe, string> = {
  "1m": "1d",
  "5m": "5d",
  "15m": "5d",
  "1h": "1mo",
  "1d": "1y",
};

const YAHOO_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1h": "60m",
  "1d": "1d",
};

async function yahooChart(symbol: string, timeframe: Timeframe) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${YAHOO_INTERVAL[timeframe]}&range=${YAHOO_RANGE[timeframe]}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol} failed: ${res.status}`);
  const json = (await res.json()) as any;
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol} returned no data`);
  return result;
}

function yahooQuoteFrom(result: any, inst: Instrument): Quote {
  const meta = result.meta ?? {};
  const price = Number(meta.regularMarketPrice ?? 0);
  // previousClose is the true prior session close; chartPreviousClose depends on
  // the requested range and is wrong for intraday windows.
  const prev = Number(meta.previousClose ?? meta.chartPreviousClose ?? price);
  return {
    symbol: inst.symbol,
    price,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    high: Number(meta.regularMarketDayHigh ?? price),
    low: Number(meta.regularMarketDayLow ?? price),
    previousClose: prev,
    currency: inst.currency,
    stale: false,
  };
}

function yahooCandlesFrom(result: any): Candle[] {
  const stamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const out: Candle[] = [];
  for (let i = 0; i < stamps.length; i++) {
    const c = q.close?.[i];
    if (c == null) continue;
    out.push({
      t: stamps[i] * 1000,
      o: Number(q.open?.[i] ?? c),
      h: Number(q.high?.[i] ?? c),
      l: Number(q.low?.[i] ?? c),
      c: Number(c),
    });
  }
  return out;
}

async function binanceQuotes(instruments: Instrument[]): Promise<Quote[]> {
  if (instruments.length === 0) return [];
  const list = JSON.stringify(instruments.map((i) => i.symbol));
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(list)}`,
  );
  if (!res.ok) throw new Error(`Binance quotes failed: ${res.status}`);
  const rows = (await res.json()) as any[];
  return rows.map((r) => ({
    symbol: r.symbol as string,
    price: Number(r.lastPrice),
    change: Number(r.priceChange),
    changePercent: Number(r.priceChangePercent),
    high: Number(r.highPrice),
    low: Number(r.lowPrice),
    previousClose: Number(r.prevClosePrice),
    currency: INSTRUMENT_MAP[r.symbol]?.currency ?? "USDT",
    stale: false,
  }));
}

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const instruments = symbols
    .map((s) => INSTRUMENT_MAP[s])
    .filter((i): i is Instrument => Boolean(i));

  const crypto = instruments.filter((i) => i.source === "binance");
  const rest = instruments.filter((i) => i.source === "yahoo");

  const [cryptoQuotes, restQuotes] = await Promise.all([
    binanceQuotes(crypto).catch(() => []),
    Promise.all(
      rest.map(async (inst) => {
        try {
          return yahooQuoteFrom(await yahooChart(inst.symbol, "1d"), inst);
        } catch {
          return null;
        }
      }),
    ),
  ]);

  const found = new Map<string, Quote>();
  for (const q of [...cryptoQuotes, ...restQuotes.filter(Boolean)] as Quote[]) {
    found.set(q.symbol, q);
  }
  return instruments.map(
    (inst) =>
      found.get(inst.symbol) ?? {
        symbol: inst.symbol,
        price: 0,
        change: 0,
        changePercent: 0,
        high: 0,
        low: 0,
        previousClose: 0,
        currency: inst.currency,
        stale: true,
      },
  );
}

export async function fetchPrice(symbol: string): Promise<number> {
  const [quote] = await fetchQuotes([symbol]);
  if (!quote || quote.stale || !quote.price) {
    throw new Error(`No live price available for ${symbol} right now.`);
  }
  return quote.price;
}

export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) throw new Error(`Unknown instrument ${symbol}`);

  if (inst.source === "binance") {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${inst.symbol}&interval=${timeframe}&limit=200`,
    );
    if (!res.ok) throw new Error(`Binance candles failed: ${res.status}`);
    const rows = (await res.json()) as any[];
    return rows.map((r) => ({
      t: Number(r[0]),
      o: Number(r[1]),
      h: Number(r[2]),
      l: Number(r[3]),
      c: Number(r[4]),
    }));
  }

  const result = await yahooChart(inst.symbol, timeframe);
  return yahooCandlesFrom(result).slice(-200);
}
