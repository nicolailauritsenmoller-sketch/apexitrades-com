import { describe, expect, it } from "vitest";
import { summarizeDesks } from "./leaderboard-summary";

describe("desk summary", () => {
  it("aggregates the displayed desks and excludes unreported Sharpe ratios", () => {
    expect(summarizeDesks([{ volume_30d: 1000000, pnl_30d: 200000, sharpe: 2 }, { volume_30d: 500000, pnl_30d: 80000, sharpe: 4 }, { volume_30d: 250000, pnl_30d: -1000, sharpe: null }])).toEqual({ volume: 1750000, sharpe: 3, topPnl: 200000 });
  });
  it("does not manufacture a Sharpe ratio or top result for an empty feed", () => {
    expect(summarizeDesks([])).toEqual({ volume: 0, sharpe: null, topPnl: null });
  });
});