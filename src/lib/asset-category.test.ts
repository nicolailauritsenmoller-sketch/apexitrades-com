import { describe, expect, it } from "vitest";
import { categoryOf } from "./asset-category";

describe("categoryOf", () => {
  it("USDT and coins are crypto", () => {
    expect(categoryOf("USDT")).toBe("crypto");
    expect(categoryOf("USDC")).toBe("crypto");
    expect(categoryOf("BTC")).toBe("crypto");
  });
  it("cash currencies are fiat", () => {
    for (const c of ["USD", "EUR", "GBP"]) expect(categoryOf(c)).toBe("fiat");
  });
  it("currency pairs are forex", () => {
    expect(categoryOf("EUR/USD")).toBe("forex");
    expect(categoryOf("GBPUSD")).toBe("forex");
  });
});
