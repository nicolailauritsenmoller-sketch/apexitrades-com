import { heartbeatAgeSeconds } from "./last-seen";

export type ActivitySession = { id: string; lastActiveAt: string };

/** Match the live desk's Active state: a heartbeat less than 30 seconds old. */
export function activitySnapshot(rows: readonly ActivitySession[], now: number) {
  return new Map(rows.map(row => [row.id, (heartbeatAgeSeconds(row.lastActiveAt, now) ?? Infinity) < 30]));
}

/** The first snapshot is a silent baseline; repeated heartbeats are not arrivals. */
export function newlyActiveSessions(previous: ReadonlyMap<string, boolean> | null, current: ReadonlyMap<string, boolean>) {
  if (previous === null) return [];
  return [...current].filter(([id, active]) => active && previous.get(id) !== true).map(([id]) => id);
}