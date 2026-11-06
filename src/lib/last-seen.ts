/** Elapsed time since the recorded session heartbeat, not since sign-in. */
export function heartbeatAgeSeconds(timestamp: string | null | undefined, now: number): number | null {
  if (!timestamp) return null;
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || !Number.isFinite(now)) return null;
  return Math.max(0, Math.floor((now - time) / 1000));
}

export function formatLastSeen(age: number | null): string {
  if (age === null) return "Unavailable";
  if (age < 5) return "Active now";
  if (age < 60) return `${age}s ago`;
  if (age < 3600) return `${Math.floor(age / 60)}m ago`;
  return `${Math.floor(age / 3600)}h ago`;
}