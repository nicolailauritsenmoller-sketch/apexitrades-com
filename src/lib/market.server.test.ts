import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQuotes } from "./market.server";

afterEach(() => vi.unstubAllGlobals());

describe("live crypto market coverage", () => {
  it("keeps supported losing assets live when a requested catalog symbol is unavailable", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/api/v3/ticker/24hr")) {
        return Response.json([
          { symbol: "BTCUSDT", lastPrice: "100", priceChange: "-5", priceChangePercent: "-5", highPrice: "110", lowPrice: "90", prevClosePrice: "105", volume: "200", closeTime: Date.now() },
          { symbol: "ETHUSDT", lastPrice: "50", priceChange: "-1", priceChangePercent: "-2", highPrice: "55", lowPrice: "45", prevClosePrice: "51", volume: "100", closeTime: Date.now() },
        ]);
      }
      return new Response("Unavailable", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const result = await fetchQuotes(["BTCUSDT", "KASUSDT"]);
    expect(result.find(q => q.symbol === "BTCUSDT")).toMatchObject({ stale: false, price: 100, changePercent: -5 });
    expect(result.find(q => q.symbol === "KASUSDT")?.stale).toBe(true);
    expect(result.some(q => q.symbol === "ETHUSDT")).toBe(false);
    expect(fetchMock.mock.calls[0][0]).not.toContain("symbols=");
  });
  it("does not treat an outdated exchange ticker as an active losing asset", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url.includes("/api/v3/ticker/24hr")
      ? Response.json([{ symbol: "FTMUSDT", lastPrice: "1", priceChangePercent: "-10", volume: "100", closeTime: Date.now() - 86_400_000 }])
      : new Response("Unavailable", { status: 404 })));
    const [result] = await fetchQuotes(["FTMUSDT"]);
    expect(result?.stale).toBe(true);
  });
});