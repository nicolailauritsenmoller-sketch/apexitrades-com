import { describe, expect, it, vi } from "vitest";
import { scalpingRuleInput, scalpingProfit, validateScalpingOrder, type ScalpingRule } from "./scalping-rules";

const rule: ScalpingRule = { id: "ce4e4ee3-68b3-4c8e-98a4-19ae6dd1c2d3", label: "60s", duration_seconds: 60, min_trade_amount: 100, roi_pct: 10, active: true, updated_at: "2026-11-05T04:21:00+00:00", deleted_at: null };
const order = { stake: 100, durationSeconds: 60, tierVersion: rule.updated_at };
describe("Scalping configuration rules", () => {
  it.each([60, 120, 180, 86400, 604800, 245])("accepts configurable duration %s seconds", duration_seconds => {
    expect(scalpingRuleInput.parse({ ...rule, duration_seconds, reason: "Update trading terms" }).duration_seconds).toBe(duration_seconds);
  });
  it("enforces the tier's current minimum", () => {
    expect(() => validateScalpingOrder({ ...rule, min_trade_amount: 200 }, order)).toThrow("200 USDT");
    expect(validateScalpingOrder({ ...rule, min_trade_amount: 200 }, { ...order, stake: 200 }).min_trade_amount).toBe(200);
  });
  it("calculates the configured estimated ROI with existing leverage", () => {
    expect(scalpingProfit(200, 12.5, 2)).toBe(50);
  });
  it("blocks inactive tiers", () => {
    expect(() => validateScalpingOrder({ ...rule, active: false }, order)).toThrow("no longer available");
  });
  it("blocks removed tiers", () => {
    expect(() => validateScalpingOrder({ ...rule, deleted_at: rule.updated_at }, order)).toThrow("no longer available");
  });
  it("rejects stale terms instead of silently accepting a different return", () => {
    expect(() => validateScalpingOrder({ ...rule, roi_pct: 25, updated_at: "2026-11-05T04:22:00+00:00" }, order)).toThrow("configuration changed");
  });
  it("keeps duplicate-duration tiers distinct by selected identity", () => {
    const first = { ...rule, duration_seconds: 86400, roi_pct: 25 };
    const second = { ...first, id: "bcb48f8e-1f83-46e4-a492-9f63ba39c15a", roi_pct: 30 };
    expect(validateScalpingOrder(first, { ...order, durationSeconds: 86400 }).roi_pct).toBe(25);
    expect(validateScalpingOrder(second, { ...order, durationSeconds: 86400 }).roi_pct).toBe(30);
  });
});

vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn }; return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { saveScalpingRule, removeScalpingRule, getScalpingRules } from "./scalping-rules.functions";
describe("Scalping administrator authorization", () => {
  it.each([saveScalpingRule, removeScalpingRule, getScalpingRules])("rejects non-admin CRUD and management reads", async fn => {
    const from = vi.fn(() => ({ select: () => ({ eq: async () => ({ data: [{ role: "user" }], error: null }) }) }));
    const handler = fn as unknown as (args: unknown) => Promise<unknown>;
    await expect(handler({ context: { supabase: { from }, userId: "trader" }, data: { ...rule, admin: true, reason: "Test permissions" } })).rejects.toThrow("Administrator access required");
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("user_roles");
  });
});