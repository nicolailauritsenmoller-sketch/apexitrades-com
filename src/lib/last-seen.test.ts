import { describe, expect, it } from "vitest";
import { heartbeatAgeSeconds, formatLastSeen } from "./last-seen";

describe("recorded heartbeat age", () => {
  const heartbeat = "2026-11-06T01:17:00.000Z";
  const start = Date.parse(heartbeat);
  it("advances one second at a time without changing the heartbeat", () => {
    expect(heartbeatAgeSeconds(heartbeat, start + 12_000)).toBe(12);
    expect(heartbeatAgeSeconds(heartbeat, start + 13_000)).toBe(13);
  });
  it("resets elapsed age when a newer heartbeat arrives", () => {
    expect(heartbeatAgeSeconds("2026-11-06T01:17:12.000Z", start + 12_000)).toBe(0);
  });
  it("never reports negative or invalid elapsed time", () => {
    expect(heartbeatAgeSeconds(heartbeat, start - 1000)).toBe(0);
    expect(heartbeatAgeSeconds("invalid", start)).toBeNull();
    expect(heartbeatAgeSeconds(null, start)).toBeNull();
  });
});