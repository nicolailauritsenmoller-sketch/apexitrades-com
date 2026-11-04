export const LEADERBOARD_REFRESH_MS = 5 * 60 * 1000;

/** Rotate presentation only; carry the source rank with each stable card identity. */
export function rotateRankedCards<T>(rows: readonly T[], cycle: number) {
  const ranked = rows.map((entry, index) => ({ entry, rank: index + 1 }));
  if (!ranked.length) return ranked;
  const offset = cycle % ranked.length;
  return [...ranked.slice(offset), ...ranked.slice(0, offset)];
}