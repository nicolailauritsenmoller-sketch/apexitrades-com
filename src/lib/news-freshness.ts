export const NEWS_REFRESH_MS = 60_000;
export const NEWS_MAX_AGE_MS = 48 * 3600_000;
/** Missing and future dates must never make old headlines appear newly published. */
export function currentNews<T extends { publishedAt: string; id: string }>(rows: T[], now: number): T[] {
  const seen = new Set<string>();
  return rows.filter(row => {
    const timestamp = Date.parse(row.publishedAt);
    if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp > NEWS_MAX_AGE_MS || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}