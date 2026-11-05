import { FEED_NAMES } from "./operations-health";
export async function runFeedChecks(db: any) {
  const { fetchAlpha } = await import("./alpha.server");
  const { fetchNewListings } = await import("./new-listings.server");
  const { fetchQuotes } = await import("./market.server");
  const probes: Record<keyof typeof FEED_NAMES, () => Promise<number>> = {
    alpha: async () => { const feed = await fetchAlpha(); return feed.unavailable ? 0 : feed.rows.length; },
    listings: async () => { const feed = await fetchNewListings(); return feed.unavailable ? 0 : feed.rows.length; },
    quotes: async () => (await fetchQuotes(["BTCUSDT", "ETHUSDT", "SOLUSDT"])).filter(q => !q.stale && q.price > 0).length,
    chart: async () => {
      for (const host of ["https://data-api.binance.vision", "https://api.binance.com"]) {
        try {
          const response = await fetch(`${host}/api/v3/klines?symbol=BTCUSDT&interval=15m&limit=80`, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) continue;
          const rows = await response.json() as unknown;
          const count = Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && Number(r[4]) > 0 && Number(r[0]) <= Date.now()).length : 0;
          if (count) return count;
        } catch { /* Try the next provider. */ }
      }
      const response = await fetch("https://api.exchange.coinbase.com/products/BTC-USD/candles?granularity=900", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return 0;
      const rows = await response.json() as unknown;
      return Array.isArray(rows) ? rows.filter(r => Array.isArray(r) && Number(r[4]) > 0 && Number(r[0]) * 1000 <= Date.now()).length : 0;
    },
    news: async () => {
      const response = await fetch("https://cointelegraph.com/rss", { signal: AbortSignal.timeout(8000) });
      if (!response.ok) return 0;
      const text = await response.text();
      return text.split(/<item[\s>]/).slice(1).filter(block => {
        const date = block.match(/<pubDate[^>]*>([^<]+)<\/pubDate>/)?.[1];
        const stamp = date ? Date.parse(date) : NaN;
        return stamp <= Date.now() && stamp >= Date.now() - 48 * 3600_000;
      }).length;
    },
  };
  await Promise.all(Object.entries(probes).map(async ([feed, probe]) => {
    const start = Date.now(); let count = 0;
    try { count = await probe(); } catch { /* Only safe health categories are retained. */ }
    const status = count === 0 ? "unavailable" : feed === "quotes" && count < 3 ? "degraded" : "healthy";
    const { data: prev, error: readError } = await db.from("operations_feed_checks").select("last_success_at").eq("feed", feed).maybeSingle();
    if (readError) throw new Error("Could not read feed health history.");
    const stamp = new Date().toISOString();
    const { error } = await db.from("operations_feed_checks").upsert({ feed, checked_at: stamp, last_success_at: count > 0 ? stamp : prev?.last_success_at ?? null, status, row_count: count, latency_ms: Date.now() - start, detail: count === 0 ? "No usable current provider rows" : "Provider sample checked" });
    if (error) throw new Error("Could not save feed check results.");
  }));
}