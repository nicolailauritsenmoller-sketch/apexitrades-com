import { createServerFn } from "@tanstack/react-start";

/** Ticker -> USD market cap map for the homepage market table. CoinGecko with server-side caching. */
export const getMarketCaps = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchMarketCaps } = await import("./market-cap.server");
  return fetchMarketCaps();
});
