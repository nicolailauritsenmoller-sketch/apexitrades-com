import { describe, expect, it } from "vitest";
import { scalpingRuleInput, scalpingCommission, scalpingProfit, validateScalpingOrder, SCALPING_MAJORS } from "./scalping-rules";

const rule = { ...scalpingRuleInput.parse({ label: "Risk test", duration_seconds: 60, min_trade_amount: 100, max_trade_amount: 500, commission_pct: 1.5, daily_payout_cap: 1000, allowed_pairs: ["BTCUSDT"], roi_pct: 10, active: true }), id: "ce4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3", updated_at: "2026-11-05T05:23:00+00:00", deleted_at: null };
const order = { stake: 500, durationSeconds: 60, tierVersion: rule.updated_at, symbol: "BTCUSDT" };
describe("Scalping risk parameters", () => {
  it("restricts individual sizing to the configured maximum including the boundary", () => {
    expect(validateScalpingOrder(rule, order).max_trade_amount).toBe(500);
    expect(() => validateScalpingOrder(rule, { ...order, stake: 501 })).toThrow("Maximum investment");
  });
  it("rejects a maximum below the minimum", () => {
    expect(scalpingRuleInput.safeParse({ ...rule, max_trade_amount: 99 }).success).toBe(false);
  });
  it("permits only designated pairs", () => {
    expect(validateScalpingOrder(rule, order).allowed_pairs).toEqual(["BTCUSDT"]);
    expect(() => validateScalpingOrder(rule, { ...order, symbol: "ETHUSDT" })).toThrow("not eligible");
  });
  it("all pairs includes a catalog pair outside the majors preset", () => {
    expect(validateScalpingOrder({ ...rule, allowed_pairs: [] }, { ...order, symbol: "AAPL" }).allowed_pairs).toEqual([]);
    expect(() => validateScalpingOrder({ ...rule, allowed_pairs: SCALPING_MAJORS }, { ...order, symbol: "AAPL" })).toThrow("not eligible");
  });
  it("rejects fabricated pair restrictions", () => {
    expect(scalpingRuleInput.safeParse({ ...rule, allowed_pairs: ["NOT_A_MARKET"] }).success).toBe(false);
  });
  it("deducts protocol commission once on stake, not leverage or profit", () => {
    expect(scalpingCommission(500, 1.5)).toBe(7.5);
    expect(scalpingProfit(500, 10, 2)).toBe(100);
  });
  it("requires nonnegative commission no greater than 100 percent", () => {
    expect(scalpingRuleInput.safeParse({ ...rule, commission_pct: -1 }).success).toBe(false);
    expect(scalpingRuleInput.safeParse({ ...rule, commission_pct: 101 }).success).toBe(false);
  });
  it("requires a positive daily payout cap or unlimited", () => {
    expect(scalpingRuleInput.safeParse({ ...rule, daily_payout_cap: 0 }).success).toBe(false);
    expect(scalpingRuleInput.parse({ ...rule, daily_payout_cap: null }).daily_payout_cap).toBeNull();
    expect(scalpingRuleInput.parse(rule).daily_payout_cap).toBe(1000);
  });
  it("preserves legacy defaults without introducing limits or extra fees", () => {
    const result = scalpingRuleInput.parse({ label: "Legacy", duration_seconds: 60, min_trade_amount: 100, roi_pct: 10, active: true });
    expect([result.max_trade_amount, result.daily_payout_cap]).toEqual([null, null]);
    expect(result.commission_pct).toBe(0);
    expect(result.allowed_pairs).toEqual([]);
  });
});