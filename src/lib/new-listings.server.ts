import { applyListingQuotes, parseRecentListings, type ListingAnnouncement, type ListingTicker, type RecentListing } from "./new-listings";

const CMS = "https://www.binance.com/bapi/composite/v1/public/cms/article/list/query";
let announcementsCache: { at: number; rows: ListingAnnouncement[] } | null = null;
let capsCache: { at: number; caps: Record<string, number> } | null = null;

async function json<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error("Listing provider unavailable");
  return response.json() as Promise<T>;
}

async function exchange<T>(path: string): Promise<T> {
  for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
    try { return await json<T>(`${host}${path}`); } catch { /* Try the public mirror. */ }
  }
  throw new Error("Exchange data unavailable");
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
    const [tickers, info, caps] = await Promise.all([
      exchange<ListingTicker[]>("/api/v3/ticker/24hr").catch(() => []),
      exchange<{ symbols: { symbol: string; status: string; isSpotTradingAllowed: boolean }[] }>("/api/v3/exchangeInfo").catch(() => ({ symbols: [] })),
      marketCaps(rows),
    ]);
    // Do not label markets upcoming just because exchange status could not be fetched.
    if (!info.symbols.length) return { rows: [], unavailable: true, asOf: Date.now() };
    const active = new Set(info.symbols.filter(s => s.status === "TRADING" && s.isSpotTradingAllowed).map(s => s.symbol));
    return { rows: applyListingQuotes(rows, tickers, active, Date.now()).map(row => ({ ...row, marketCap: caps[row.ticker] ?? null })), unavailable: !tickers.length, asOf: Date.now() };
  } catch { return { rows: [], unavailable: true, asOf: Date.now() }; }
}