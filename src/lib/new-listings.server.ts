import { applyListingQuotes, parseRecentListings, type ListingAnnouncement, type ListingTicker, type RecentListing } from "./new-listings";

const CMS = "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query";
let announcementsCache: { at: number; rows: ListingAnnouncement[] } | null = null;
let capsCache: { at: number; caps: Record<string, number> } | null = null;
type SpotProduct = { s: string; st: string; q: string; c: string; o: string; qv: string };
let productsCache: { at: number; rows: SpotProduct[] } | null = null;

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Listing provider unavailable");
  return response.json() as Promise<T>;
}

async function spotProducts(): Promise<{ at: number; rows: SpotProduct[] }> {
  if (productsCache && Date.now() - productsCache.at < 20_000) return productsCache;
  const response = await json<{ data?: SpotProduct[] }>("https://www.binance.com/bapi/asset/v2/public/asset-service/product/get-products?includeEtf=false");
  if (!Array.isArray(response.data) || !response.data.length) throw new Error("Spot products unavailable");
  productsCache = { at: Date.now(), rows: response.data };
  return productsCache;
}

async function announcements(): Promise<ListingAnnouncement[]> {
  if (announcementsCache && Date.now() - announcementsCache.at < 300_000) return announcementsCache.rows;
  const pages = await Promise.all([1, 2, 3].map(page => json<{ data?: { catalogs?: { articles?: ListingAnnouncement[] }[] } }>(`${CMS}?type=1&pageNo=${page}&pageSize=50&catalogId=48`)));
  const rows = pages.flatMap(page => page.data?.catalogs?.flatMap(c => c.articles ?? []) ?? []);
  if (!rows.length) throw new Error("Announcements unavailable");
  announcementsCache = { at: Date.now(), rows };
  return rows;
}

/** Match both name and ticker so ambiguous ticker collisions never produce another token's cap. */
async function marketCaps(rows: RecentListing[]): Promise<Record<string, number>> {
  if (capsCache && Date.now() - capsCache.at < 600_000) return capsCache.caps;
  const matches: { ticker: string; id: string }[] = [];
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let offset = 0; offset < rows.length; offset += 4) {
    const batch = await Promise.all(rows.slice(offset, offset + 4).map(async row => {
      try {
        const data = await json<{ coins?: { id: string; symbol: string; name: string }[] }>(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(row.ticker)}`);
        const coin = data.coins?.find(c => c.symbol.toUpperCase() === row.ticker && normalize(c.name) === normalize(row.name));
        return coin ? { ticker: row.ticker, id: coin.id } : null;
      } catch { return null; }
    }));
    for (const match of batch) if (match) matches.push(match);
  }
  if (!matches.length) return capsCache?.caps ?? {};
  try {
    const data = await json<{ id: string; market_cap: number | null }[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${encodeURIComponent(matches.map(m => m.id).join(","))}`);
    const caps: Record<string, number> = {};
    for (const coin of data) {
      const match = matches.find(m => m.id === coin.id);
      if (match && typeof coin.market_cap === "number" && Number.isFinite(coin.market_cap) && coin.market_cap > 0) caps[match.ticker] = coin.market_cap;
    }
    capsCache = { at: Date.now(), caps };
    return caps;
  } catch { return capsCache?.caps ?? {}; }
}

export async function fetchNewListings(): Promise<{ rows: RecentListing[]; unavailable: boolean; asOf: number }> {
  try {
    const articles = await announcements();
    const rows = parseRecentListings(articles, Date.now()).slice(0, 20);
    const [products, caps] = await Promise.all([
      spotProducts(),
      marketCaps(rows),
    ]);
    // Official web spot feed avoids repeated heavyweight exchangeInfo calls and supplies 24h quote volume.
    const active = new Set(products.rows.filter(s => s.st === "TRADING" && s.q === "USDT").map(s => s.s));
    const tickers: ListingTicker[] = products.rows.map(s => ({ symbol: s.s, lastPrice: s.c, quoteVolume: s.qv, closeTime: products.at, priceChangePercent: Number(s.o) > 0 ? String((Number(s.c) / Number(s.o) - 1) * 100) : "NaN" }));
    return { rows: applyListingQuotes(rows, tickers, active, Date.now()).map(row => ({ ...row, marketCap: caps[row.ticker] ?? null })), unavailable: false, asOf: products.at };
  } catch { return { rows: [], unavailable: true, asOf: Date.now() }; }
}