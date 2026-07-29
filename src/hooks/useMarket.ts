import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getQuotes, getCandles } from "@/lib/market.functions";
import type { Quote, Candle, Timeframe } from "@/lib/market-types";

export function useQuotes(symbols: string[], intervalMs = 5000) {
  const fetchQuotes = useServerFn(getQuotes);
  const key = [...symbols].sort().join(",");

  const query = useQuery({
    queryKey: ["quotes", key],
    queryFn: () => fetchQuotes({ data: { symbols } }) as Promise<Quote[]>,
    refetchInterval: intervalMs,
    refetchOnWindowFocus: true,
    enabled: symbols.length > 0,
    staleTime: 0,
  });

  const map: Record<string, Quote> = {};
  for (const q of query.data ?? []) map[q.symbol] = q;
  return { quotes: map, list: query.data ?? [], isLoading: query.isLoading };
}

export function useCandles(symbol: string, timeframe: Timeframe) {
  const fetchCandles = useServerFn(getCandles);
  return useQuery({
    queryKey: ["candles", symbol, timeframe],
    queryFn: () => fetchCandles({ data: { symbol, timeframe } }) as Promise<Candle[]>,
    refetchInterval: timeframe === "1d" ? 60_000 : 15_000,
    staleTime: 0,
  });
}
