import { describe, expect, it } from "vitest";
import { displayedFeeRate } from "./fee-discount";

describe("ETH fee schedule discount", () => {
  it("reduces maker and taker rates by 25% for all five tiers", () => {
    const tiers = [
      [0.1, 0.1], [0.09, 0.1], [0.08, 0.09], [0.07, 0.08], [0.06, 0.07],
    ];
    expect(tiers.map(rates => rates.map(rate => displayedFeeRate(rate, true))))
      .toEqual([[0.075, 0.075], [0.0675, 0.075], [0.06, 0.0675], [0.0525, 0.06], [0.045, 0.0525]]);
  });

  it("restores base rates when switched off", () => {
    expect(displayedFeeRate(0.1, false)).toBe(0.1);
    expect(displayedFeeRate("0.016", false)).toBe(0.016);
  });

  it("discounts margin, futures and scalp rates using the same rule", () => {
    expect(displayedFeeRate("0.02", true)).toBe(0.015);
    expect(displayedFeeRate(0.05, true)).toBe(0.0375);
    expect(displayedFeeRate(0.016, true)).toBe(0.012);
  });

  it("preserves zero fees and negative maker rebates", () => {
    expect(displayedFeeRate(0, true)).toBe(0);
    expect(displayedFeeRate(-0.01, true)).toBe(-0.01);
  });

  it("does not manufacture unconfigured rates", () => {
    expect(displayedFeeRate(null, true)).toBeNull();
    expect(displayedFeeRate(undefined, true)).toBeNull();
    expect(displayedFeeRate("unavailable", true)).toBeNull();
  });
});