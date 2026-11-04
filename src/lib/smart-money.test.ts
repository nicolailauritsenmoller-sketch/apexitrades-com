import { describe, it, expect } from "vitest";
import { classifyTrend } from "./smart-money.functions";
describe("classifyTrend", () => {
  it("strong accumulation at +4%", () => expect(classifyTrend(0.04)).toBe("Strong Accumulation"));
  it("neutral inside +/-1%", () => expect(classifyTrend(0.005)).toBe("Neutral"));
  it("distribution at -1%", () => expect(classifyTrend(-0.01)).toBe("Distribution"));
  it("strong distribution at -5%", () => expect(classifyTrend(-0.05)).toBe("Strong Distribution"));
});
