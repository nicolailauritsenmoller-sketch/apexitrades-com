import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSettlementCandles } from "./settlement-candles.server";

afterEach(() => vi.unstubAllGlobals());
describe("settlement historical candles", () => {
  it("requests the actual trade window and rejects out-of-window or invalid candles", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify([
      [120000, "10", "12", "9", "11"],
      [180000, "11", "13", "10", "12"],
      [240000, "12", "14", "11", "13"],
      [150000, null, null, null, null],
    ])));
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchSettlementCandles("BTCUSDT", 121, 199)).toEqual([
      { t: 120, o: 10, h: 12, l: 9, c: 11 }, { t: 180, o: 11, h: 13, l: 10, c: 12 },
    ]);
    expect(fetcher.mock.calls[0][0]).toContain("startTime=120000&endTime=199000");
  });
  it("returns unavailable rather than inventing price action when providers fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unavailable")));
    expect(await fetchSettlementCandles("BTCUSDT", 121, 199)).toEqual([]);
  });
});