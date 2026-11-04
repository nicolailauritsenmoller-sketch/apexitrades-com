import { describe, expect, it } from "vitest";
import { DISPLAY_CURRENCIES, convertDisplayAmount, formatDisplayAmount, parseDisplayFx } from "./display-currency-values";

describe("CAD display conversion", () => {
  it("offers CAD alongside all existing display currencies", () => {
    expect(DISPLAY_CURRENCIES.map(c => c.code)).toEqual(["USDT", "USD", "EUR", "GBP", "CAD", "BTC"]);
  });
  it("converts a USDT balance to CAD using USDT per CAD", () => {
    expect(convertDisplayAmount(100, 1 / 1.4)).toBeCloseTo(140);
    expect(formatDisplayAmount(convertDisplayAmount(100, 1 / 1.4), "CAD")).toBe("CA$140.00");
  });
  it("uses real USD/CAD fallback in the correct direction", () => {
    expect(parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { CAD: 1.4 } }, 1000_000).CAD).toBeCloseTo(1 / 1.4);
  });
  it("rejects stale FX instead of inventing a conversion", () => {
    expect(parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { CAD: 1.4 } }, 1000_000 + 49 * 3600_000)).toEqual({});
    expect(formatDisplayAmount(convertDisplayAmount(100, 0), "CAD")).toBe("-");
  });
});