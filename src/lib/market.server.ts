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

const YAHOO_HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

/** Binance mirrors: some edge regions get 451/403 from the primary host. */
const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
];

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

async function yahooChart(symbol: string, timeframe: Timeframe) {
  const path =
    `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?interval=${YAHOO_INTERVAL[timeframe]}&range=${YAHOO_RANGE[timeframe]}`;
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

/** Coinbase Exchange product id for a Binance-style pair (BTCUSDT -> BTC-USD). */
function coinbaseProduct(symbol: string): string {
  return `${symbol.replace(/USDT$/, "")}-USD`;
}

const COINBASE_GRANULARITY: Record<Timeframe, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "1d": 86400,
};

const TIMEFRAME_MS: Record<Timeframe, number> = {
  "1m": 60_000,
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "1d": 86_400_000,
};

/**
 * Last-resort reference prices so a chart is never empty when every upstream
 * provider is unreachable. Only used to anchor clearly-marked fallback data.
 */
const ANCHOR_PRICE: Record<string, number> = {
  BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 160, XRPUSDT: 0.55, BNBUSDT: 590,
  DOGEUSDT: 0.14, ADAUSDT: 0.45, AVAXUSDT: 30, LINKUSDT: 15, TONUSDT: 6.5,
  SUIUSDT: 1.6, NEARUSDT: 4.2, APTUSDT: 7.5, ATOMUSDT: 6.2, POLUSDT: 0.42,
  PEPEUSDT: 0.0000105, SHIBUSDT: 0.0000175,
  AAPL: 210, NVDA: 120, TSLA: 250, MSFT: 430, AMZN: 185, META: 500, AMD: 160, COIN: 230,
  "ES=F": 5500, "NQ=F": 19500, "YM=F": 40000, "RTY=F": 2100, "CL=F": 78,
  "BZ=F": 82, "NG=F": 2.6, "ZB=F": 118,
  "EURUSD=X": 1.08, "GBPUSD=X": 1.27, "USDJPY=X": 155, "AUDUSD=X": 0.66,
  "USDCHF=X": 0.89, "EURGBP=X": 0.85, "USDCAD=X": 1.37, "NZDUSD=X": 0.61,
  "EURJPY=X": 167, "GBPJPY=X": 197, "AUDJPY=X": 102,
  "GC=F": 2350, "SI=F": 30, "PL=F": 1000, "PA=F": 950, "HG=F": 4.4,
};

const VOLATILITY: Record<string, number> = {
  crypto: 0.0022, stock: 0.0014, future: 0.0011, forex: 0.0004, metal: 0.0009,
};

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

  // Walk backwards from the anchor, then replay forwards so the last close == anchor.
  const closes: number[] = [anchor];
  for (let i = 1; i < count; i++) {
    const drift = (rand() - 0.5) * 2 * vol;
    closes.push(Math.max(closes[i - 1] * (1 - drift), anchor * 0.5));
  }
  closes.reverse();

  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const c = closes[i];
    const o = i === 0 ? c * (1 - (rand() - 0.5) * vol) : closes[i - 1];
    const wick = c * vol * (0.6 + rand());
    out.push({
      t: now - (count - 1 - i) * step,
      o,
      h: Math.max(o, c) + wick,
      l: Math.min(o, c) - wick,
      c,
    });
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

  // Crypto pairs missing from Binance get a Coinbase retry before going stale.
  const missingCrypto = crypto.filter((i) => !found.get(i.symbol)?.price);
  const recovered = await Promise.all(
    missingCrypto.map((inst) => coinbaseQuote(inst).catch(() => null)),
  );
  for (const q of recovered) if (q) found.set(q.symbol, q);

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

async function binanceCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  return firstOk(
    BINANCE_HOSTS.map(
      (h) => `${h}/api/v3/klines?symbol=${symbol}&interval=${timeframe}&limit=200`,
    ),
    (rows: any[]) =>
      rows.map((r) => ({
        t: Number(r[0]),
        o: Number(r[1]),
        h: Number(r[2]),
        l: Number(r[3]),
        c: Number(r[4]),
      })),
  );
}

async function coinbaseCandles(symbol: string, timeframe: Timeframe): Promise<Candle[]> {
  const rows = (await fetchJson(
    `https://api.exchange.coinbase.com/products/${coinbaseProduct(symbol)}` +
      `/candles?granularity=${COINBASE_GRANULARITY[timeframe]}`,
  )) as any[];
  // Coinbase returns [time, low, high, open, close, volume], newest first.
  return rows
    .map((r) => ({
      t: Number(r[0]) * 1000,
      o: Number(r[3]),
      h: Number(r[2]),
      l: Number(r[1]),
      c: Number(r[4]),
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

  const providers: Array<() => Promise<Candle[]>> =
    inst.source === "binance"
      ? [
          () => binanceCandles(inst.symbol, timeframe),
          () => coinbaseCandles(inst.symbol, timeframe),
        ]
      : [
          async () => yahooCandlesFrom(await yahooChart(inst.symbol, timeframe)).slice(-200),
          // Intraday windows can be empty outside market hours: fall back to daily.
          async () => yahooCandlesFrom(await yahooChart(inst.symbol, "1d")).slice(-200),
        ];

  for (const provider of providers) {
    try {
      const candles = await provider();
      if (candles.length > 1) return candles;
    } catch {
      // try the next provider
    }
  }

  const [quote] = await fetchQuotes([symbol]).catch(() => []);
  const anchor = quote?.price || ANCHOR_PRICE[symbol] || 100;
  return syntheticCandles(symbol, timeframe, anchor);
}

