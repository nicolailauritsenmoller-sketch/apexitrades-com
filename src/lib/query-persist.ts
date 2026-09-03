import type { QueryClient } from "@tanstack/react-query";

/**
 * Lightweight synchronous query-cache persistence.
 *
 * Snapshots a whitelist of user-scoped queries into localStorage so that on the
 * next page entry the balance, profile and navigation state render instantly
 * from cache while the network refetch happens in the background (SWR).
 */
const STORAGE_KEY = "velocity.qcache.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const PERSIST_KEYS = new Set([
  "portfolio-value",
  "portfolio",
  "profile-overview",
  "my-access",
  "my-kyc",
  "wallet-activity",
  "watchlist",
  "quotes",
  "instruments",
  "withdrawal-eligibility",
]);

type Entry = { key: unknown[]; data: unknown; updatedAt: number };

function shouldPersist(key: readonly unknown[]) {
  return typeof key[0] === "string" && PERSIST_KEYS.has(key[0]);
}

export function hydrateQueryCache(client: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as Entry[];
    const now = Date.now();
    for (const entry of entries) {
      if (!entry || !Array.isArray(entry.key)) continue;
      if (now - entry.updatedAt > MAX_AGE_MS) continue;
      client.setQueryData(entry.key, entry.data, { updatedAt: entry.updatedAt });
    }
  } catch {
    /* ignore corrupt cache */
  }
}

export function startQueryCachePersistence(client: QueryClient) {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;

  const flush = () => {
    try {
      const entries: Entry[] = [];
      for (const query of client.getQueryCache().getAll()) {
        if (query.state.status !== "success") continue;
        if (!shouldPersist(query.queryKey)) continue;
        entries.push({
          key: query.queryKey as unknown[],
          data: query.state.data,
          updatedAt: query.state.dataUpdatedAt,
        });
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* quota or serialization issues are non-fatal */
    }
  };

  const unsubscribe = client.getQueryCache().subscribe(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 400);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export function clearQueryCachePersistence() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
