import { createServerFn } from "@tanstack/react-start";

// Smart Money analytics derived only from real Binance spot market data:
// 24h net flow = taker buy quote volume - taker sell quote volume (hourly klines),
// large prints = aggregated trades >= LARGE_PRINT_USD in the latest 1000-trade sample.
const HOSTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api-gcp.binance.com"];
export const SMART_MONEY_ASSETS = ["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "AVAX", "ADA", "LINK"] as const;
const LARGE_PRINT_USD = 100_000;
const BLOCK_USD = 1_000_000;
const MIN_WHALE_USD = 5_000;
const FEED_PER_ASSET = 4;

export type FlowTrend = "Strong Accumulation" | "Accumulation" | "Neutral" | "Distribution" | "Strong Distribution";
export type SmartMoneyRow = {
  asset: string; netFlowUsd: number; quoteVolumeUsd: number; trend: FlowTrend;
  largeVolumeUsd: number; largeCount: number; thresholdUsd: number; whaleEntry: number | null; lastActivity: number | null; price: number;
};
export type WhalePrint = { id: string; asset: string; side: "buy" | "sell"; usd: number; price: number; time: number };
export type SmartMoneySnapshot = {
  rows: SmartMoneyRow[]; feed: WhalePrint[]; generatedAt: number;
  totals: { netFlowUsd: number; accumulationIndex: number; blockVolumeUsd: number; dominancePct: number; sampleVolumeUsd: number };
};

export function classifyTrend(ratio: number): FlowTrend {
  if (ratio >= 0.04) return "Strong Accumulation";
  if (ratio >= 0.01) return "Accumulation";
  if (ratio <= -0.04) return "Strong Distribution";
  if (ratio <= -0.01) return "Distribution";
  return "Neutral";
}

async function get<T>(path: string): Promise<T> {
  let last: unknown;
  for (const host of HOSTS) {
    try {
      const res = await fetch(host + path, { signal: AbortSignal.timeout(6000) });
      if (res.ok) return (await res.json()) as T;
      last = new Error(`HTTP ${res.status}`);
    } catch (e) { last = e; }
  }
  throw last;
}

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];
type AggTrade = { a: number; p: string; q: string; T: number; m: boolean };

let cache: { at: number; data: SmartMoneySnapshot } | null = null;

type OkxResp<T> = { code: string; data: T };
async function okx<T>(path: string): Promise<T> {
  const res = await fetch("https://www.okx.com" + path, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as OkxResp<T>;
  if (j.code !== "0") throw new Error(`OKX ${j.code}`);
  return j.data;
}

// Real taker flow from Binance; falls back to OKX spot taker volume + trades when Binance blocks the server.
async function loadFlow(asset: string): Promise<{ qv: number; tb: number; trades: AggTrade[]; close: number }> {
  const symbol = `${asset}USDT`;
  try {
    const [klines, trades] = await Promise.all([
      get<Kline[]>(`/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`),
      get<AggTrade[]>(`/api/v3/aggTrades?symbol=${symbol}&limit=1000`),
    ]);
    let qv = 0, tb = 0;
    for (const k of klines) { qv += Number(k[7]); tb += Number(k[10]); }
    return { qv, tb, trades, close: close };
  } catch {
    const [vol, raw] = await Promise.all([
      okx<[string, string, string][]>(`/api/v5/rubik/stat/taker-volume?ccy=${asset}&instType=SPOT&period=1H`),
      okx<{ tradeId: string; px: string; sz: string; side: string; ts: string }[]>(`/api/v5/market/trades?instId=${asset}-USDT&limit=500`),
    ]);
    const trades: AggTrade[] = raw.map(t => ({ a: Number(t.tradeId), p: t.px, q: t.sz, T: Number(t.ts), m: t.side === "sell" })).reverse();
    const close = trades.length ? Number(trades[trades.length - 1].p) : 0;
    if (!close) throw new Error("no price");
    let qv = 0, tb = 0;
    for (const [, sell, buy] of vol.slice(0, 24)) { const b = Number(buy) * close, s2 = Number(sell) * close; qv += b + s2; tb += b; }
    return { qv, tb, trades, close };
  }
}

const lastGood = new Map<string, { at: number; v: Awaited<ReturnType<typeof loadAsset>> }>();

async function loadAsset(asset: string) {
  const { qv, tb, trades, close } = await loadFlow(asset);
  const netFlowUsd = 2 * tb - qv;
  // Dynamic whale threshold: top 2% of prints in this asset's sample, floored at MIN_WHALE_USD,
  // so thinner books (ADA, AVAX, LINK) still surface their genuinely largest trades.
  const sized = trades.map(t => ({ t, price: Number(t.p), qty: Number(t.q), usd: Number(t.p) * Number(t.q) }));
  const sorted = sized.map(x => x.usd).sort((a, b) => a - b);
  const p98 = sorted.length ? sorted[Math.floor(sorted.length * 0.98)] : 0;
  const threshold = Math.max(MIN_WHALE_USD, Math.min(LARGE_PRINT_USD, p98));
  let sampleUsd = 0, largeUsd = 0, largeQty = 0, blockUsd = 0, largeCount = 0, lastActivity: number | null = null;
  const prints: WhalePrint[] = [];
  for (const { t, price, qty, usd } of sized) {
    sampleUsd += usd;
    if (usd >= BLOCK_USD) blockUsd += usd;
    if (usd >= threshold) {
      largeUsd += usd; largeQty += qty; largeCount++;
      lastActivity = Math.max(lastActivity ?? 0, t.T);
      prints.push({ id: `${asset}-${t.a}`, asset, side: t.m ? "sell" : "buy", usd, price, time: t.T });
    }
  }
  prints.sort((a, b) => b.usd - a.usd).splice(FEED_PER_ASSET);
  const price = trades.length ? Number(trades[trades.length - 1].p) : close;
  const row: SmartMoneyRow = {
    asset, netFlowUsd, quoteVolumeUsd: qv, trend: classifyTrend(qv ? netFlowUsd / qv : 0),
    largeVolumeUsd: largeUsd, largeCount, thresholdUsd: threshold, whaleEntry: largeQty ? largeUsd / largeQty : null, lastActivity, price,
  };
  return { row, prints, sampleUsd, blockUsd };
}

export const getSmartMoney = createServerFn({ method: "GET" }).handler(async (): Promise<SmartMoneySnapshot | null> => {
  if (cache && Date.now() - cache.at < 10_000) return cache.data;
  const results = await Promise.allSettled(SMART_MONEY_ASSETS.map(loadAsset));
  const ok = results.flatMap((r, i) => {
    const asset = SMART_MONEY_ASSETS[i];
    if (r.status === "fulfilled") { lastGood.set(asset, { at: Date.now(), v: r.value }); return [r.value]; }
    const prev = lastGood.get(asset);
    return prev && Date.now() - prev.at < 15 * 60_000 ? [prev.v] : [];
  });
  if (!ok.length) { console.error("smart money: all sources failed"); return cache?.data ?? null; }
  const rows = ok.map(r => r.row);
  const netFlowUsd = rows.reduce((s, r) => s + r.netFlowUsd, 0);
  const qv = rows.reduce((s, r) => s + r.quoteVolumeUsd, 0);
  const sampleVolumeUsd = ok.reduce((s, r) => s + r.sampleUsd, 0);
  const largeUsd = rows.reduce((s, r) => s + r.largeVolumeUsd, 0);
  const data: SmartMoneySnapshot = {
    rows: rows.sort((a, b) => b.quoteVolumeUsd - a.quoteVolumeUsd),
    feed: ok.flatMap(r => r.prints).sort((a, b) => b.time - a.time).slice(0, 30),
    generatedAt: Date.now(),
    totals: {
      netFlowUsd,
      accumulationIndex: qv ? Math.round(50 + 50 * Math.max(-1, Math.min(1, (netFlowUsd / qv) * 10))) : 50,
      blockVolumeUsd: ok.reduce((s, r) => s + r.blockUsd, 0),
      dominancePct: sampleVolumeUsd ? (largeUsd / sampleVolumeUsd) * 100 : 0,
      sampleVolumeUsd,
    },
  };
  cache = { at: Date.now(), data };
  return data;
});
