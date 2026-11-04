import { describe, expect, it } from "vitest";
import { resolveMinimum } from "./deposit-minimums";
const rules = [
  { user_id: null, coin: "USDT", min_amount: 10 },
  { user_id: "u1", coin: "USDT", min_amount: 500 },
];
describe("resolveMinimum", () => {
  it("prefers the per-user override", () => expect(resolveMinimum(rules, "u1", "usdt")).toEqual({ amount: 500, source: "user" }));
  it("falls back to the global default", () => expect(resolveMinimum(rules, "u2", "USDT")).toEqual({ amount: 10, source: "global" }));
  it("returns null without a rule", () => expect(resolveMinimum(rules, "u1", "BTC")).toBeNull());
});
