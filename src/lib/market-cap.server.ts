/** Server-only market cap adapter: CoinGecko markets API with a short-lived in-memory cache. */

const CG_HOST = "https://api.coingecko.com/api/v3";
const TTL_MS = 10 * 60 * 1000;

let cache: { at: number; caps: Record<string, number> } | null = null;

/**
 * Returns ticker (e.g. "BTC") -> market cap in USD for the top ~500 coins.
 * The highest-cap coin wins on ticker collisions since pages arrive in market cap order.
 */
export async function fetchMarketCaps(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.caps;
  try {
    const pages = await Promise.all(
      [1, 2].map((page) =>
        fetch(`${CG_HOST}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`, {
          headers: { accept: "application/json" },
        }).then((r) => (r.ok ? r.json() : []))
      )
    );
    const caps: Record<string, number> = {};
    for (const row of pages.flat() as Array<{ symbol?: string; market_cap?: number | null }>) {
      const symbol = row.symbol?.toUpperCase();
      const cap = row.market_cap;
      if (symbol && Number.isFinite(cap) && cap > 0 && caps[symbol] === undefined) caps[symbol] = cap;
    }
    if (Object.keys(caps).length > 0) cache = { at: Date.now(), caps };
    return cache?.caps ?? {};
  } catch {
    return cache?.caps ?? {};
  }
}
