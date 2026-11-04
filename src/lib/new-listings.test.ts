import { describe, expect, it } from "vitest";
import { applyListingQuotes, parseRecentListings } from "./new-listings";

const now = Date.UTC(2026, 10, 4);
const article = { code: "a259777ee4104befa3daba5c1eadc7b5c", title: "Binance Will List Predict (PREDICT) with Seed Tag Applied", releaseDate: now - 86_400_000 };
describe("verified new listings", () => {
  it("selects recent new spot tokens, excluding old tokens and futures announcements", () => {
    const rows = parseRecentListings([article, { ...article, title: "Binance Futures Will List Predict (PREDICT)" }, { ...article, title: "Binance Will List Old (OLD) with Seed Tag Applied", releaseDate: now - 91 * 86_400_000 }], now);
    expect(rows.map(row => row.symbol)).toEqual(["PREDICTUSDT"]);
  });
  it("deduplicates tokens and preserves official announcement dates", () => {
    const rows = parseRecentListings([article, { ...article, releaseDate: now - 2 * 86_400_000 }], now);
    expect(rows).toHaveLength(1);
    expect(rows[0].announcedAt).toBe(article.releaseDate);
  });
  it("uses exact USDT quote volume and active exchange status for live metrics", () => {
    const rows = applyListingQuotes(parseRecentListings([article], now), [{ symbol: "PREDICTUSDT", lastPrice: "1.24", priceChangePercent: "-7.5", quoteVolume: "4000000", closeTime: now }], new Set(["PREDICTUSDT"]), now);
    expect(rows[0]).toMatchObject({ status: "listed", price: 1.24, changePercent: -7.5, volume: 4_000_000 });
  });
  it("never supplies tradable prices for announced pairs or stale tickers", () => {
    const listings = parseRecentListings([article], now);
    const tickers = [{ symbol: "PREDICTUSDT", lastPrice: "1.24", priceChangePercent: "5", quoteVolume: "1000", closeTime: now - 121_000 }];
    expect(applyListingQuotes(listings, tickers, new Set(["PREDICTUSDT"]), now)[0].price).toBeNull();
    expect(applyListingQuotes(listings, [{ ...tickers[0], closeTime: now }], new Set(), now)[0]).toMatchObject({ status: "announced", price: null });
  });
});