import type { Quote } from "./market-types";

/** Editorial widgets must never present simulated fallback anchors as live quotes. */
export function articleQuote(quote: Quote | undefined) {
  return quote && !quote.stale && Number.isFinite(quote.price) && quote.price > 0 && Number.isFinite(quote.changePercent) ? quote : null;
}