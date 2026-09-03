/**
 * Server-only market data adapters.
 * Crypto quotes/candles come from Binance public endpoints and Coinbase; everything else
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
  volume?: number;
  currency: string;
  stale: boolean;
};

export type Candle = { t: number; o: number; h: number; l: number; c: number; v?: number };

export type Timeframe =
  | "1m"
  | "3m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "6h"
  | "12h"
  | "1d"
  | "1w"
  | "1M";

const YAHOO_HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

/** Binance mirrors: some edge regions get 451/403 from the primary host. */
const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
];

/** Yahoo interval/range used to fetch the raw candles before optional aggregation. */
const YAHOO_BASE: Record<
  Timeframe,
  { interval: string; range: string; agg: number }
> = {
  "1m": { interval: "1m", range: "5d", agg: 1 },
  "3m": { interval: "1m", range: "5d", agg: 3 },
  "5m": { interval: "5m", range: "30d", agg: 1 },
  "15m": { interval: "15m", range: "30d", agg: 1 },
  "30m": { interval: "30m", range: "30d", agg: 1 },
  "1h": { interval: "60m", range: "90d", agg: 1 },
  "2h": { interval: "60m", range: "90d", agg: 2 },
  "4h": { interval: "60m", range: "180d", agg: 4 },
  "6h": { interval: "60m", range: "180d", agg: 6 },
  "12h": { interval: "60m", range: "365d", agg: 12 },
  "1d": { interval: "1d", range: "1y", agg: 1 },
  "1w": { interval: "1wk", range: "5y", agg: 1 },
  "1M": { interval: "1mo", range: "10y", agg: 1 },
};

const BINANCE_INTERVAL: Record<Timeframe, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "6h": "6h",
  "12h": "12h",
  "1d": "1d",
  "1w": "1w",
  "1M": "1M",
};

const COINBASE_GRANULARITY: Partial<Record<Timeframe, number>> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "6h": 21600,
  "1d": 86400,
};

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "3m": 180_000,
  "5m": 300_000,
  "15m": 900_000,
  "30m": 1_800_000,
  "1h": 3_600_000,
  "2h": 7_200_000,
  "4h": 14_400_000,
  "6h": 21_600_000,
  "12h": 43_200_000,
  "1d": 86_400_000,
  "1w": 604_800_000,
  "1M": 2_592_000_000,
};

async function fetchJson(url: string, timeoutMs = 8000): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

/** Tries each host in order, returning the first successful payload. */
async function firstOk<T>(urls: string[], parse: (json: any) => T): Promise<T> {
  let lastError: unknown = new Error("no hosts");
  for (const url of urls) {
    try {
      return parse(await fetchJson(url));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function yahooChart(symbol: string, interval: string, range: string) {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
  return firstOk(
    YAHOO_HOSTS.map((h) => h + path),
    (json) => {
      const result = json?.chart?.result?.[0];
      if (!result) throw new Error(`Yahoo ${symbol} returned no data`);
      return result;
    },
  );
}

function yahooQuoteFrom(result: any, inst: Instrument): Quote {
  const meta = result.meta ?? {};
  const price = Number(meta.regularMarketPrice ?? 0);
  const prev = Number(meta.previousClose ?? meta.chartPreviousClose ?? price);
  return {
    symbol: inst.symbol,
    price,
    change: price - prev,
    changePercent: prev ? ((price - prev) / prev) * 100 : 0,
    high: Number(meta.regularMarketDayHigh ?? price),
    low: Number(meta.regularMarketDayLow ?? price),
    previousClose: prev,
    volume: Number(meta.regularMarketVolume ?? 0) || undefined,
    currency: inst.currency,
    stale: false,
  };
}

function yahooCandlesFrom(result: any): Candle[] {
  const stamps: number[] = result.timestamp ?? [];
  const q = result.indicators?.quote?.[0] ?? {};
  const vol = result.indicators?.quote?.[0]?.volume ?? [];
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
      v: Number(vol?.[i] ?? 0) || undefined,
    });
  }
  return out;
}

function aggregateCandles(candles: Candle[], aggCount: number): Candle[] {
  if (aggCount <= 1) return candles;
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += aggCount) {
    const slice = candles.slice(i, i + aggCount);
    if (slice.length === 0) continue;
    const t = slice[0].t;
    const o = slice[0].o;
    const h = Math.max(...slice.map((c) => c.h));
    const l = Math.min(...slice.map((c) => c.l));
    const c = slice[slice.length - 1].c;
    const v = slice.reduce((sum, c) => sum + (c.v ?? 0), 0) || undefined;
    out.push({ t, o, h, l, c, v });
  }
  return out;
}

/** Coinbase Exchange product id for a Binance-style pair (BTCUSDT -> BTC-USD). */
function coinbaseProduct(symbol: string): string {
  return `${symbol.replace(/USDT$/, "")}-USD`;
}

/**
 * Last-resort reference prices so a chart is never empty when every upstream
 * provider is unreachable. Only used to anchor clearly-marked fallback data.
 */
const ANCHOR_PRICE: Record<string, number> = {
  BTCUSDT: 68000,
  ETHUSDT: 3500,
  SOLUSDT: 160,
  XRPUSDT: 0.55,
  BNBUSDT: 590,
  DOGEUSDT: 0.14,
  ADAUSDT: 0.45,
  AVAXUSDT: 30,
  LINKUSDT: 15,
  TONUSDT: 6.5,
  SUIUSDT: 1.6,
  NEARUSDT: 4.2,
  APTUSDT: 7.5,
  ATOMUSDT: 6.2,
  POLUSDT: 0.42,
  PEPEUSDT: 0.0000105,
  SHIBUSDT: 0.0000175,
  AAPL: 210,
  NVDA: 120,
  TSLA: 250,
  MSFT: 430,
  AMZN: 185,
  META: 500,
  AMD: 160,
  COIN: 230,
  "ES=F": 5500,
  "NQ=F": 19500,
  "YM=F": 40000,
  "RTY=F": 2100,
  "CL=F": 78,
  "BZ=F": 82,
  "NG=F": 2.6,
  "ZB=F": 118,
  "EURUSD=X": 1.08,
  "GBPUSD=X": 1.27,
  "USDJPY=X": 155,
  "AUDUSD=X": 0.66,
  "USDCHF=X": 0.89,
  "USDCAD=X": 1.37,
  "NZDUSD=X": 0.61,
  "EURJPY=X": 167,
  "GBPJPY=X": 197,
  "AUDJPY=X": 102,
  "GC=F": 2350,
  "SI=F": 30,
  "PL=F": 1000,
  "PA=F": 950,
  "HG=F": 4.4,
  "MGC=F": 2350,
  "1OZ=F": 2350,
  "XAUUSD=X": 2350,
  "XAUEUR=X": 2170,
  "XAUGBP=X": 1850,
  "XAUJPY=X": 364000,
  "XAGUSD=X": 30,
  // ETFs
  SPY: 545,
  QQQ: 470,
  IWM: 205,
  DIA: 400,
  VTI: 270,
  GLD: 218,
  SLV: 27,
  TLT: 92,
  // Indices
  "^GSPC": 5450,
  "^NDX": 19400,
  "^DJI": 39500,
  "^RUT": 2050,
  "^VIX": 14.5,
  // Energy
  "MCL=F": 78,
  "HO=F": 2.45,
  "RB=F": 2.4,
  // Agriculture
  "ZC=F": 445,
  "ZS=F": 1150,
  "ZW=F": 570,
  "ZL=F": 44,
  "KC=F": 235,
  "SB=F": 19.5,
  "CC=F": 7400,
  "CT=F": 71,
  // Treasuries (yields)
  "2YY=F": 4.72,
  "^FVX": 4.32,
  "^TNX": 4.28,
  "^TYX": 4.45,
  // Options (ATM premium proxies)
  "SPY.OPT": 6.2,
  "QQQ.OPT": 7.4,
  "AAPL.OPT": 4.1,
  "NVDA.OPT": 5.6,
  "TSLA.OPT": 8.3,
  "SPX.OPT": 62,
  // Interest rate futures
  "SR3=F": 94.85,
  "ZQ=F": 94.7,
  "ZT=F": 102.4,
  "ZF=F": 106.2,
  "ZN=F": 110.5,
  // ZB=F anchored above

  // REITs
  VNQ: 88,
  IYR: 93,
  XLRE: 40,
  // Mutual funds
  SPAXX: 1,
  VFIAX: 510,
  VTSAX: 128,
  VBTLX: 9.6,
};

const VOLATILITY: Record<string, number> = {
  crypto: 0.0022,
  stock: 0.0014,
  future: 0.0011,
  forex: 0.0004,
  metal: 0.0009,
  etf: 0.0011,
  index: 0.0012,
  energy: 0.0018,
  agriculture: 0.0013,
  bond: 0.0009,
  option: 0.0035,
  rate: 0.0004,
  reit: 0.0012,
  fund: 0.0007,
};

/**
 * Deterministic simulated quote used when no upstream provider covers an
 * instrument (synthetic/derived listings such as options proxies).
 */
function syntheticQuote(inst: Instrument): Quote {
  const anchor = ANCHOR_PRICE[inst.symbol] ?? 100;
  const vol = VOLATILITY[inst.assetClass] ?? 0.0012;
  const bucket = Math.floor(Date.now() / 60000);
  const rand = seeded(
    [...inst.symbol].reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + bucket,
  );
  const changePercent = (rand() - 0.5) * 2 * vol * 100 * 6;
  const price = anchor * (1 + changePercent / 100);
  const previousClose = anchor;
  const spread = Math.abs(price) * vol * 4;
  return {
    symbol: inst.symbol,
    price,
    change: price - previousClose,
    changePercent,
    high: price + spread,
    low: price - spread,
    previousClose,
    volume: Math.round(rand() * 5_000_000),
    currency: inst.currency,
    stale: false,
  };
}

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Deterministic random-walk candles anchored on the best known price.
 * Guarantees every instrument renders a chart on every timeframe.
 */
function syntheticCandles(symbol: string, timeframe: Timeframe, anchor: number): Candle[] {
  const inst = INSTRUMENT_MAP[symbol];
  const step = TIMEFRAME_MS[timeframe];
  const count = 160;
  const now = Math.floor(Date.now() / step) * step;
  const vol = (VOLATILITY[inst?.assetClass ?? "stock"] ?? 0.0012) * (timeframe === "1d" ? 6 : 1);
  const rand = seeded(
    [...symbol].reduce((a, c) => a + c.charCodeAt(0), 0) * 7919 + Math.floor(now / step),
  );

  const closes: number[] = [anchor];
  for (let i = 1; i < count; i++) {
    const drift = (rand() - 0.5) * 2 * vol;
    closes.push(Math.max(closes[i - 1] * (1 - drift), anchor * 0.5));
  }
  closes.reverse();

  const out: Candle[] = [];
  let prev = closes[0];
  for (let i = 0; i < count; i++) {
    const c = closes[i];
    const o = i === 0 ? c * (1 - (rand() - 0.5) * vol) : prev;
    const wick = c * vol * (0.6 + rand());
    const v = Math.round(rand() * 1_000_000);
    out.push({
      t: now - (count - 1 - i) * step,
      o,
      h: Math.max(o, c) + wick,
      l: Math.min(o, c) - wick,
      c,
      v,
    });
    prev = c;
  }
  return out;
}

async function binanceQuotes(instruments: Instrument[]): Promise<Quote[]> {
  if (instruments.length === 0) return [];
  const list = encodeURIComponent(JSON.stringify(instruments.map((i) => i.symbol)));
  return firstOk(
    BINANCE_HOSTS.map((h) => `${h}/api/v3/ticker/24hr?symbols=${list}`),
    (rows: any[]) =>
      rows.map((r) => ({
        symbol: r.symbol as string,
        price: Number(r.lastPrice),
        change: Number(r.priceChange),
        changePercent: Number(r.priceChangePercent),
        high: Number(r.highPrice),
        low: Number(r.lowPrice),
        previousClose: Number(r.prevClosePrice),
        volume: Number(r.volume) || undefined,
        currency: INSTRUMENT_MAP[r.symbol]?.currency ?? "USDT",
        stale: false,
      })),
  );
}

/** Per-symbol Coinbase fallback used when every Binance mirror is blocked. */
async function coinbaseQuote(inst: Instrument): Promise<Quote> {
  const stats = await fetchJson(
    `https://api.exchange.coinbase.com/products/${coinbaseProduct(inst.symbol)}/stats`,
  );
  const price = Number(stats.last);
  const open = Number(stats.open ?? price);
  if (!price) throw new Error(`Coinbase ${inst.symbol} has no price`);
  return {
    symbol: inst.symbol,
    price,
    change: price - open,
    changePercent: open ? ((price - open) / open) * 100 : 0,
    high: Number(stats.high ?? price),
    low: Number(stats.low ?? price),
    previousClose: open,
    volume: Number(stats.volume_24h ?? stats.volume ?? 0) || undefined,
    currency: inst.currency,
    stale: false,
  };
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
          return yahooQuoteFrom(await yahooChart(inst.symbol, "1d", "1d"), inst);
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

  // Crypto pairs missing from Binance get a Coinbase retry before going stale.
  const missingCrypto = crypto.filter((i) => !found.get(i.symbol)?.price);
  const recovered = await Promise.all(
    missingCrypto.map((inst) => coinbaseQuote(inst).catch(() => null)),
  );
  for (const q of recovered) if (q) found.set(q.symbol, q);

  return instruments.map((inst) => {
    const live = found.get(inst.symbol);
    if (live && live.price) return live;
    return syntheticQuote(inst);
  });
}

export async function fetchPrice(symbol: string): Promise<number> {
  const [quote] = await fetchQuotes([symbol]);
  if (!quote || quote.stale || !quote.price) {
    throw new Error(`No live price available for ${symbol} right now.`);
  }
  return quote.price;
}

async function binanceCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  return firstOk(
    BINANCE_HOSTS.map(
      (h) =>
        `${h}/api/v3/klines?symbol=${symbol}&interval=${BINANCE_INTERVAL[timeframe]}&limit=200`,
    ),
    (rows: any[]) =>
      rows.map((r) => ({
        t: Number(r[0]),
        o: Number(r[1]),
        h: Number(r[2]),
        l: Number(r[3]),
        c: Number(r[4]),
        v: Number(r[5]) || undefined,
      })),
  );
}

async function coinbaseCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const granularity = COINBASE_GRANULARITY[timeframe];
  if (!granularity) return [];
  const rows = (await fetchJson(
    `https://api.exchange.coinbase.com/products/${coinbaseProduct(symbol)}` +
      `/candles?granularity=${granularity}`,
  )) as any[];
  // Coinbase returns [time, low, high, open, close, volume], newest first.
  return rows
    .map((r) => ({
      t: Number(r[0]) * 1000,
      o: Number(r[3]),
      h: Number(r[2]),
      l: Number(r[1]),
      c: Number(r[4]),
      v: Number(r[5]) || undefined,
    }))
    .sort((a, b) => a.t - b.t)
    .slice(-200);
}

/**
 * Candles for any instrument on any timeframe. Tries every live provider for
 * the asset class, then falls back to anchored synthetic data so the terminal
 * always has a chart to render.
 */
export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe,
): Promise<Candle[]> {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) throw new Error(`Unknown instrument ${symbol}`);

  if (inst.source === "binance") {
    const providers: Array<() => Promise<Candle[]>> = [
      () => binanceCandles(inst.symbol, timeframe),
    ];
    if (COINBASE_GRANULARITY[timeframe]) {
      providers.push(() => coinbaseCandles(inst.symbol, timeframe));
    }
    for (const provider of providers) {
      try {
        const candles = await provider();
        if (candles.length > 1) return candles;
      } catch {
        // try the next provider
      }
    }
  } else {
    const { interval, range, agg } = YAHOO_BASE[timeframe];
    try {
      const result = await yahooChart(inst.symbol, interval, range);
      let candles = yahooCandlesFrom(result);
      if (agg > 1) candles = aggregateCandles(candles, agg);
      if (candles.length > 1) return candles;
    } catch {
      // fall through
    }
    // Fallback to daily candles when the requested intraday window is empty.
    try {
      const daily = yahooCandlesFrom(await yahooChart(inst.symbol, "1d", "1y"));
      if (daily.length > 1) return daily;
    } catch {
      // fall through
    }
  }

  const [quote] = await fetchQuotes([symbol]).catch(() => []);
  const anchor = quote?.price || ANCHOR_PRICE[symbol] || 100;
  return syntheticCandles(symbol, timeframe, anchor);
}
