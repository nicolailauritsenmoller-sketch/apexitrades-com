import { describe, expect, it } from "vitest";
import { articleQuote } from "./article-quotes";
import type { Quote } from "./market-types";

const quote: Quote = { symbol: "BTCUSDT", price: 75000, change: 100, changePercent: 1.2, high: 76000, low: 74000, previousClose: 74900, currency: "USDT", stale: false };
describe("Article live prices", () => {
  it("rejects simulated or missing quotes", () => {
    expect(articleQuote({ ...quote, stale: true })).toBeNull();
    expect(articleQuote(undefined)).toBeNull();
  });
  it("retains the exact live price and change", () => {
    expect(articleQuote(quote)).toEqual(quote);
    expect(articleQuote({ ...quote, price: NaN })).toBeNull();
  });
});