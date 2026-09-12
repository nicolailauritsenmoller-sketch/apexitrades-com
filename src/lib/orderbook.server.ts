/**
 * Server-only order book adapter.
 * Crypto books come from Binance's public depth endpoint; every other asset class
 * gets a deterministic synthetic book derived from its live quote so the terminal
 * always renders a plausible ladder.
 */
import { INSTRUMENT_MAP } from "./instruments";
import { fetchQuotes } from "./market.server";

export type DepthLevel = { price: number; qty: number };
export type Depth = { symbol: string; bids: DepthLevel[]; asks: DepthLevel[]; synthetic: boolean };

const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
];

async function fetchJson(url: string, timeoutMs = 6000): Promise<any> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function parseLevels(rows: unknown): DepthLevel[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r: any) => ({ price: Number(r?.[0]), qty: Number(r?.[1]) }))
    .filter((l) => Number.isFinite(l.price) && Number.isFinite(l.qty) && l.qty > 0);
}

async function binanceDepth(symbol: string, limit: number): Promise<Depth> {
  let lastError: unknown = new Error("no hosts");
  for (const host of BINANCE_HOSTS) {
    try {
      const json = await fetchJson(`${host}/api/v3/depth?symbol=${symbol}&limit=${limit}`);
      const bids = parseLevels(json.bids);
      const asks = parseLevels(json.asks);
      if (bids.length === 0 || asks.length === 0) throw new Error("empty book");
      return { symbol, bids, asks, synthetic: false };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** Deterministic pseudo-random in [0,1) so the synthetic ladder is stable per tick. */
function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function syntheticDepth(symbol: string, price: number, levels: number): Depth {
  const inst = INSTRUMENT_MAP[symbol];
  const tick = price * 0.0002;
  const size = Math.max((inst?.step ?? 1) * 2, 1);
  const seedBase = Math.floor(Date.now() / 2000) + symbol.length;
  const bids: DepthLevel[] = [];
  const asks: DepthLevel[] = [];
  for (let i = 0; i < levels; i++) {
    const spread = tick * (i + 1);
    bids.push({
      price: price - spread,
      qty: +(size * (0.4 + rand(seedBase + i) * 2.2)).toFixed(4),
    });
    asks.push({
      price: price + spread,
      qty: +(size * (0.4 + rand(seedBase + 500 + i) * 2.2)).toFixed(4),
    });
  }
  return { symbol, bids, asks, synthetic: true };
}

export async function fetchDepth(symbol: string, limit = 40): Promise<Depth> {
  const inst = INSTRUMENT_MAP[symbol];
  if (!inst) throw new Error("Unknown instrument");
  if (inst.source === "binance") {
    try {
      return await binanceDepth(symbol, Math.min(100, Math.max(limit, 20)));
    } catch {
      /* fall through to synthetic */
    }
  }
  const [quote] = await fetchQuotes([symbol]);
  const price = quote?.price;
  if (!price) throw new Error("No price available");
  return syntheticDepth(symbol, price, limit);
}
