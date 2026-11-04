import { INSTRUMENTS } from "./instruments";
import type { Candle } from "./market-types";

export const ALPHA_REFRESH_MS = 30_000;
export type AlphaToken = {
  tokenId: string; alphaId: string; chain: string; address: string; name: string; ticker: string;
  logoUrl: string | null; price: number; changePercent: number; volume: number;
  marketCap: number | null; liquidity: number | null; listedAt: number | null; terminalSymbol: string | null;
};
export type AlphaFeed = { rows: AlphaToken[]; asOf: number; unavailable: boolean };
export type AlphaFilter = "Trending" | "Early-stage" | "Liquidity" | "Momentum";
const number = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v); return Number.isFinite(n) ? n : null;
};

export function parseAlphaTokens(data: unknown, now: number): AlphaToken[] {
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  return data.flatMap((raw): AlphaToken[] => {
    if (!raw || typeof raw !== "object") return [];
    const r = raw as Record<string, unknown>;
    const price = number(r.price), change = number(r.percentChange24h), volume = number(r.volume24h);
    if (typeof r.tokenId !== "string" || typeof r.alphaId !== "string" || !/^ALPHA_\d+$/.test(r.alphaId) || typeof r.symbol !== "string" || typeof r.name !== "string" || r.offline === true || r.fullyDelisted === true || r.offsell === true || price === null || price <= 0 || change === null || volume === null || volume <= 0 || seen.has(r.tokenId)) return [];
    seen.add(r.tokenId);
    const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
    // An Alpha ticker alone is not proof of catalog identity: require CEX listing and an exact name match.
    const market = r.listingCex === true ? INSTRUMENTS.find(i => i.assetClass === "crypto" && i.symbol === `${r.cexCoinName || r.symbol}USDT` && normalize(i.name) === normalize(r.name as string)) : undefined;
    let logoUrl: string | null = null;
    if (typeof r.iconUrl === "string") { try { const url = new URL(r.iconUrl); if (url.protocol === "https:" && url.hostname === "bin.bnbstatic.com") logoUrl = url.href; } catch { /* Invalid logo. */ } }
    const cap = number(r.marketCap), liquidity = number(r.liquidity), listedAt = number(r.listingTime);
    return [{ tokenId: r.tokenId, alphaId: r.alphaId, chain: String(r.chainName ?? ""), address: String(r.contractAddress ?? ""), name: r.name, ticker: r.symbol,
      logoUrl, price, changePercent: change, volume, marketCap: cap !== null && cap > 0 ? cap : null,
      liquidity: liquidity !== null && liquidity > 0 ? liquidity : null, listedAt: listedAt !== null && listedAt > 0 && listedAt <= now ? listedAt : null, terminalSymbol: market?.symbol ?? null }];
  });
}

export function alphaRows(rows: AlphaToken[], filter: AlphaFilter, search: string, now: number) {
  const term = search.trim().toLowerCase();
  return rows.filter(r => `${r.name} ${r.ticker} ${r.chain}`.toLowerCase().includes(term))
    .filter(r => filter === "Early-stage" ? r.listedAt !== null && now - r.listedAt <= 90 * 86_400_000 : filter === "Momentum" ? r.changePercent > 0 : filter === "Liquidity" ? r.liquidity !== null : true)
    .sort((a, b) => filter === "Momentum" ? b.changePercent - a.changePercent : filter === "Liquidity" ? (b.liquidity ?? 0) - (a.liquidity ?? 0) : filter === "Early-stage" ? (b.listedAt ?? 0) - (a.listedAt ?? 0) : b.volume - a.volume);
}

export function parseAlphaCandles(data: unknown, now: number): Candle[] {
  if (!Array.isArray(data)) return [];
  const rows = data.flatMap((row): Candle[] => {
    if (!Array.isArray(row)) return [];
    const [t, o, h, l, c, v] = row.slice(0, 6).map(Number);
    return [t, o, h, l, c, v].every(Number.isFinite) && t > 0 && t <= now && Math.min(o, h, l, c) > 0 && h >= Math.max(o, c, l) && l <= Math.min(o, c) && v >= 0 ? [{ t, o, h, l, c, v }] : [];
  });
  return rows.length && now - rows[rows.length - 1].t < 2 * 3600_000 ? rows : [];
}