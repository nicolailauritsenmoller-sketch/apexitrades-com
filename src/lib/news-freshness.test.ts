import { expect, it } from "vitest";
import { currentNews, NEWS_REFRESH_MS } from "./news-freshness";
const now = Date.UTC(2026, 10, 4, 23, 28);
it("only publishes current, dated articles and rejects future or undated news", () => {
  expect(currentNews([
    { id: "current", publishedAt: new Date(now - 3600_000).toISOString() },
    { id: "old", publishedAt: new Date(now - 49 * 3600_000).toISOString() },
    { id: "future", publishedAt: new Date(now + 3600_000).toISOString() },
    { id: "missing", publishedAt: "" },
  ], now).map(r => r.id)).toEqual(["current"]);
});
it("deduplicates and orders articles newest first", () => {
  const old = { id: "old", publishedAt: new Date(now - 7200_000).toISOString() };
  const recent = { id: "recent", publishedAt: new Date(now - 1000).toISOString() };
  expect(currentNews([old, recent, recent], now).map(r => r.id)).toEqual(["recent", "old"]);
});
it("refreshes news every minute", () => { expect(NEWS_REFRESH_MS).toBe(60_000); });