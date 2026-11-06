import { describe, expect, it } from "vitest";
import { DISPLAY_CURRENCIES, convertDisplayAmount, formatDisplayAmount, parseDisplayFx } from "./display-currency-values";

describe("CAD display conversion", () => {
  it("offers CAD alongside all existing display currencies", () => {
    expect(DISPLAY_CURRENCIES.map(c => c.code)).toEqual(["USDT", "USD", "EUR", "GBP", "CAD", "AED", "AUD", "CHF", "RUB", "SGD", "TND", "VES", "JPY", "BTC"]);
  });
  it("converts a USDT balance to CAD using USDT per CAD", () => {
    expect(convertDisplayAmount(100, 1 / 1.4)).toBeCloseTo(140);
    expect(formatDisplayAmount(convertDisplayAmount(100, 1 / 1.4), "CAD")).toBe("$140.00");
  });
  it("uses real USD/CAD fallback in the correct direction", () => {
    expect(parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { CAD: 1.4 } }, 1000_000).CAD).toBeCloseTo(1 / 1.4);
  });
  it("rejects stale FX instead of inventing a conversion", () => {
    expect(parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { CAD: 1.4 } }, 1000_000 + 49 * 3600_000)).toEqual({});
    expect(formatDisplayAmount(convertDisplayAmount(100, 0), "CAD")).toBe("-");
  });
});

describe("additional display currencies", () => {
  it.each([
    ["AED", 3.67], ["AUD", 1.52], ["CHF", 0.88], ["RUB", 97],
    ["SGD", 1.34], ["TND", 3.1], ["VES", 45], ["JPY", 150],
  ])("converts balances using the provider rate for %s", (code, quote) => {
    const rates = parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { [code]: quote } }, 1000_000);
    expect(convertDisplayAmount(100, rates[code])).toBeCloseTo(100 * quote);
  });
  it("uses yen and dinar currency precision", () => {
    expect(formatDisplayAmount(15000.25, "JPY")).toBe("¥15,000");
    expect(formatDisplayAmount(310.125, "TND")).toBe("310.125 TND");
  });
  it("does not invent unsupported or invalid rates", () => {
    expect(parseDisplayFx({ result: "success", base_code: "USD", time_last_update_unix: 1000, rates: { AED: 0, AUD: -1, CHF: Infinity } }, 1000_000)).toEqual({});
  });
});