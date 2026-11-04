import { describe, expect, it } from "vitest";
import { LEADERBOARD_REFRESH_MS, rotateRankedCards } from "./leaderboard-refresh";

describe("five-minute leaderboard refresh", () => {
  it("refreshes every exact five minutes", () => {
    expect(LEADERBOARD_REFRESH_MS).toBe(300000);
  });
  it("rotates cards without changing their actual ranks or identities", () => {
    const rows = [{ id: "alpha", followed: true }, { id: "beta", followed: false }, { id: "gamma", followed: true }];
    expect(rotateRankedCards(rows, 1)).toEqual([{ entry: rows[1], rank: 2 }, { entry: rows[2], rank: 3 }, { entry: rows[0], rank: 1 }]);
    expect(rows[0]).toEqual({ id: "alpha", followed: true });
  });
  it("wraps around safely and handles empty filtered lists", () => {
    expect(rotateRankedCards(["alpha", "beta"], 2)).toEqual([{ entry: "alpha", rank: 1 }, { entry: "beta", rank: 2 }]);
    expect(rotateRankedCards([], 10)).toEqual([]);
  });
});