import { describe, expect, it } from "vitest";
import { activitySnapshot, newlyActiveSessions } from "./user-activity-events";

const now = Date.parse("2026-11-06T01:25:00Z");
const session = (id: string, age: number) => ({ id, lastActiveAt: new Date(now - age * 1000).toISOString() });

describe("user activity audio events", () => {
  it("does not alert for sessions already active on initial load", () => {
    expect(newlyActiveSessions(null, activitySnapshot([session("existing", 0)], now))).toEqual([]);
  });
  it("alerts when a new live session arrives", () => {
    expect(newlyActiveSessions(new Map(), activitySnapshot([session("new", 0)], now))).toEqual(["new"]);
  });
  it("alerts when an idle session transitions to active", () => {
    expect(newlyActiveSessions(activitySnapshot([session("returning", 30)], now), activitySnapshot([session("returning", 0)], now))).toEqual(["returning"]);
  });
  it("does not repeat alerts for ordinary active heartbeats", () => {
    expect(newlyActiveSessions(activitySnapshot([session("live", 20)], now), activitySnapshot([session("live", 0)], now))).toEqual([]);
  });
  it("does not alert for stale, invalid or removed sessions", () => {
    const current = activitySnapshot([session("stale", 30), { id: "invalid", lastActiveAt: "bad" }], now);
    expect(newlyActiveSessions(new Map([["removed", true]]), current)).toEqual([]);
  });
});