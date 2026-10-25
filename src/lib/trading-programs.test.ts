import { describe, expect, it } from "vitest";
import { leaderApplicationSchema, programRequestSchema } from "./trading-programs";

describe("copy enrollment safeguards", () => {
  it("accepts the four supported leverage levels and rejects unsupported leverage", () => {
    for (const leverage of [1, 2, 5, 10]) expect(programRequestSchema.parse({ program: "copy_trading", leverage }).leverage).toBe(leverage);
    expect(programRequestSchema.safeParse({ program: "copy_trading", leverage: 100 }).success).toBe(false);
  });
  it("requires explicit leader publication consent", () => {
    expect(leaderApplicationSchema.safeParse({ publicName: "Trader", bio: "", consent: false }).success).toBe(false);
    expect(leaderApplicationSchema.parse({ publicName: "Trader", bio: "", consent: true }).consent).toBe(true);
  });
  it("rejects negative and nonfinite requested budgets", () => {
    expect(programRequestSchema.safeParse({ program: "copy_trading", budget: -1 }).success).toBe(false);
    expect(programRequestSchema.safeParse({ program: "copy_trading", budget: Infinity }).success).toBe(false);
  });
});