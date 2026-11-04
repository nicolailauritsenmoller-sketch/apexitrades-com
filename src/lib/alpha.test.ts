import { describe, expect, it } from "vitest";
import { ALPHA_REFRESH_MS, alphaRows, parseAlphaCandles, parseAlphaTokens } from "./alpha";
const now = 1_800_000_000_000;
const token = { tokenId: "real", alphaId: "ALPHA_1", symbol: "BTC", name: "Different Bitcoin", price: "1.2", percentChange24h: "9.5", volume24h: "123456", marketCap: "456789", liquidity: "12345", listingTime: now - 1000, iconUrl: "https://bin.bnbstatic.com/token.png", listingCex: true };
describe("Alpha intelligence", () => {
  it("uses actual provider prices, volume, cap and liquidity", () => {
    expect(parseAlphaTokens([token], now)[0]).toMatchObject({ price: 1.2, changePercent: 9.5, volume: 123456, marketCap: 456789, liquidity: 12345 });
  });
  it("does not authorize a ticker collision for order execution", () => { expect(parseAlphaTokens([token], now)[0].terminalSymbol).toBeNull(); });
  it("excludes delisted and invalid price feeds", () => {
    expect(parseAlphaTokens([{ ...token, offline: true }, { ...token, price: "NaN" }], now)).toEqual([]);
  });
  it("filters early-stage by real listing time and momentum by positive change", () => {
    const rows = parseAlphaTokens([token, { ...token, tokenId: "old", listingTime: now - 91 * 86_400_000, percentChange24h: "-5" }], now);
    expect(alphaRows(rows, "Early-stage", "", now).map(r => r.tokenId)).toEqual(["real"]);
    expect(alphaRows(rows, "Momentum", "", now).map(r => r.tokenId)).toEqual(["real"]);
  });
  it("rejects stale chart candles", () => { expect(parseAlphaCandles([[now - 3 * 3600_000, 1, 2, 1, 2, 10]], now)).toEqual([]); });
  it("refreshes live intelligence every thirty seconds", () => { expect(ALPHA_REFRESH_MS).toBe(30_000); });
});