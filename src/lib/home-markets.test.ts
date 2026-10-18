import { describe, expect, it } from "vitest";
import { homeMarketRows, sparklinePoints } from "./home-markets";
import type { Instrument } from "./instruments";
import type { Quote } from "./market-types";

const instruments: Instrument[] = [
  { symbol: "BTCUSDT", name: "Bitcoin", assetClass: "crypto", currency: "USDT", source: "binance", precision: 2, step: 0.001 },
  { symbol: "ETHUSDT", name: "Ethereum", assetClass: "crypto", currency: "USDT", source: "binance", precision: 2, step: 0.01 },
  { symbol: "AAPL", name: "Apple", assetClass: "stock", currency: "USD", source: "yahoo", precision: 2, step: 1 },
];
const quote = (symbol: string, changePercent: number, stale = false): Quote => ({ symbol, price: 100, change: 1, changePercent, stale, high: 110, low: 90, previousClose: 99, currency: "USD" });
describe("homepage live market filters", () => {
  it("Favorites includes only the trader's saved symbols", () => {
    expect(homeMarketRows(instruments, {}, ["ETHUSDT"], "Favorites", "Crypto", "").map(i => i.symbol)).toEqual(["ETHUSDT"]);
  });
  it("Gainers excludes declines and unavailable or stale quotes", () => {
    const quotes = { BTCUSDT: quote("BTCUSDT", -2), ETHUSDT: quote("ETHUSDT", 8, true) };
    expect(homeMarketRows(instruments, quotes, [], "Gainers", "Crypto", "")).toEqual([]);
    quotes.ETHUSDT.stale = false;
    expect(homeMarketRows(instruments, quotes, [], "Gainers", "Crypto", "").map(i => i.symbol)).toEqual(["ETHUSDT"]);
  });
  it("TradFi excludes crypto and follows the Stocks filter", () => {
    expect(homeMarketRows(instruments, {}, [], "TradFi", "Stocks", "").map(i => i.symbol)).toEqual(["AAPL"]);
  });
  it("search matches names as well as symbols", () => {
    expect(homeMarketRows(instruments, {}, [], "Hot", "Crypto", "bitcoin").map(i => i.symbol)).toEqual(["BTCUSDT"]);
  });
  it("does not invent Alpha eligibility or new listing dates", () => {
    expect(homeMarketRows(instruments, {}, [], "Alpha", "Crypto", "")).toEqual([]);
    expect(homeMarketRows(instruments, {}, [], "New", "Crypto", "")).toEqual([]);
  });
  it("renders a flat real price series without division by zero", () => {
    expect(sparklinePoints([100, 100, 100])).toBe("0,40 120,40 240,40");
    expect(sparklinePoints([])).toBe("");
  });
});