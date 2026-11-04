export type ListingAnnouncement = { code: string; title: string; releaseDate: number };
export type RecentListing = {
  symbol: string; ticker: string; name: string; announcedAt: number; announcementUrl: string;
  status: "listed" | "announced"; price: number | null; changePercent: number | null;
  volume: number | null; marketCap: number | null; logoUrl?: string | null;
};

/** Only official new spot-token announcements, not futures launches or extra pairs for old tokens. */
export function parseRecentListings(articles: ListingAnnouncement[], now: number): RecentListing[] {
  const seen = new Set<string>();
  return [...articles].sort((a, b) => b.releaseDate - a.releaseDate).flatMap(article => {
    const match = article.title.match(/^Binance Will List (.+?) \(([^)]+)\)(?: with|$)/i);
    if (!match || !/^[a-f0-9]{32}$/.test(article.code) || !Number.isFinite(article.releaseDate) || article.releaseDate > now || now - article.releaseDate > 90 * 86_400_000) return [];
    const ticker = match[2].trim().toUpperCase();
    if (seen.has(ticker)) return [];
    seen.add(ticker);
    return [{ ticker, symbol: `${ticker}USDT`, name: match[1].trim(), announcedAt: article.releaseDate,
      announcementUrl: `https://www.binance.com/en/support/announcement/${article.code}`,
      status: "announced" as const, price: null, changePercent: null, volume: null, marketCap: null }];
  });
}

export type ListingTicker = { symbol: string; lastPrice: string; priceChangePercent: string; quoteVolume: string; closeTime: number };
export function applyListingQuotes(listings: RecentListing[], tickers: ListingTicker[], tradingSymbols: Set<string>, now: number): RecentListing[] {
  const quotes = new Map(tickers.map(t => [t.symbol, t]));
  return listings.map(listing => {
    const quote = quotes.get(listing.symbol);
    const price = Number(quote?.lastPrice), change = Number(quote?.priceChangePercent), volume = Number(quote?.quoteVolume);
    const listed = tradingSymbols.has(listing.symbol);
    const live = listed && quote && Number.isFinite(quote.closeTime) && Math.abs(now - quote.closeTime) <= 120_000 && Number.isFinite(price) && price > 0 && Number.isFinite(change) && Number.isFinite(volume) && volume >= 0;
    return { ...listing, status: listed ? "listed" : "announced", price: live ? price : null, changePercent: live ? change : null, volume: live ? volume : null };
  });
}