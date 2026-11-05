import { describe, expect, it } from "vitest";
import { filterSettlementCandles, settlementInterval } from "./settlement-chart";

describe("settlement candle context", () => {
  it("selects bounded historical resolution for short and day-long contracts", () => {
    expect(settlementInterval(0, 78000)).toEqual({ binance: "1m", seconds: 60 });
    expect(settlementInterval(0, 86400000)).toEqual({ binance: "1h", seconds: 3600 });
  });
  it("excludes unrelated and malformed candles without generating replacement prices", () => {
    const candle = { t: 60000, o: 100, h: 110, l: 90, c: 105 };
    expect(filterSettlementCandles([candle, { ...candle, t: 0 }, { ...candle, t: 180000 }, { ...candle, h: 1 }, { ...candle, o: NaN }], 65000, 130000, 60)).toEqual([candle]);
    expect(filterSettlementCandles([], 65000, 130000, 60)).toEqual([]);
  });
});