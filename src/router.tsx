import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { hydrateQueryCache, startQueryCachePersistence } from "./lib/query-persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Stale-while-revalidate: render cached data instantly, refresh quietly.
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
        refetchOnMount: "always",
        placeholderData: (prev: unknown) => prev,
      },
    },
  });

  if (typeof window !== "undefined") {
    hydrateQueryCache(queryClient);
    startQueryCachePersistence(queryClient);
  }

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch route chunks + data on hover/touch so top-level page switches are instant.
    defaultPreload: "intent",
    defaultPreloadDelay: 20,
    defaultPreloadStaleTime: 0,
    // Never flash a blocking spinner on navigation; keep the old screen until ready.
    defaultPendingMs: 3_000,
    defaultPendingMinMs: 0,
  });

  return router;
};
