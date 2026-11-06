import { describe, expect, it } from "vitest";
import { PRIME_TIERS, collateralProgress, feeBps } from "./prime-tiers";

describe("Prime collateral requirements", () => {
  it.each([[1, 10_000], [2, 20_000], [3, 50_000], [4, 100_000]])("level %i requires exactly %i USDT", (level, threshold) => {
    const tier = PRIME_TIERS.find(t => t.level === level);
    expect(tier?.threshold).toBe(threshold);
    expect(collateralProgress(threshold - 0.01, threshold).qualified).toBe(false);
    expect(collateralProgress(threshold, threshold)).toEqual({ qualified: true, remaining: 0, percent: 100 });
  });
  it("does not count collateral above the threshold as extra progression", () => {
    expect(collateralProgress(25_000, 20_000)).toEqual({ qualified: true, remaining: 0, percent: 100 });
  });
  it("converts percentage fees and negative maker rebates into basis points", () => {
    expect(feeBps(0.016)).toBe("1.6 bps fee");
    expect(feeBps(-0.008)).toBe("0.8 bps rebate");
    expect(feeBps(null)).toBe("Not configured");
  });
});