import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const quotesInput = z.object({ symbols: z.array(z.string().max(20)).max(500) });
const candlesInput = z.object({
  symbol: z.string().max(20),
  timeframe: z.enum([
    "1m",
    "3m",
    "5m",
    "15m",
    "30m",
    "1h",
    "2h",
    "4h",
    "6h",
    "12h",
    "1d",
    "1w",
    "1M",
  ]),
});

export const getQuotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => quotesInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchQuotes } = await import("./market.server");
    return fetchQuotes(data.symbols);
  });

export const getCandles = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => candlesInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchCandles } = await import("./market.server");
    try {
      return await fetchCandles(data.symbol, data.timeframe);
    } catch {
      return [];
    }
  });
