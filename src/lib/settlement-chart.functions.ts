import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filterSettlementCandles, settlementInterval } from "./settlement-chart";
import type { Candle } from "./market-types";

/** Reads only the caller's settled contract; external candles are context, not fill evidence. */
export const getSettlementCandles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: contract, error } = await context.supabase.from("contracts")
      .select("symbol,opened_at,settled_at,status").eq("id", data.id).eq("user_id", context.userId).maybeSingle();
    if (error || !contract || contract.status !== "settled" || !contract.settled_at) return { candles: [], source: null };
    const start = Date.parse(contract.opened_at);
    const end = Date.parse(contract.settled_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return { candles: [], source: null };
    const { INSTRUMENT_MAP } = await import("./instruments");
    const instrument = INSTRUMENT_MAP[contract.symbol];
    if (!instrument || instrument.assetClass !== "crypto") return { candles: [], source: null };
    const interval = settlementInterval(start, end);
    try {
      const params = new URLSearchParams({ symbol: contract.symbol, interval: interval.binance,
        startTime: String(Math.floor(start / (interval.seconds * 1000)) * interval.seconds * 1000), endTime: String(end), limit: "200" });
      const response = await fetch(`https://data-api.binance.vision/api/v3/klines?${params}`, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const rows: unknown = await response.json();
        if (Array.isArray(rows)) {
          const candles = filterSettlementCandles(rows.filter(Array.isArray).map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]) })), start, end, interval.seconds);
          if (candles.length) return { candles, source: `Binance spot · ${interval.binance} candles` };
        }
      }
    } catch { /* Try independent historical provider; never synthesize. */ }
    try {
      const base = contract.symbol.replace(/(USDT|USD)$/, "");
      const params = new URLSearchParams({ start: new Date(start).toISOString(), end: new Date(end).toISOString(), granularity: String(interval.seconds) });
      const response = await fetch(`https://api.exchange.coinbase.com/products/${encodeURIComponent(base)}-USD/candles?${params}`, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const rows: unknown = await response.json();
        if (Array.isArray(rows)) {
          const candles: Candle[] = rows.filter(Array.isArray).map((r) => ({ t: Number(r[0]) * 1000, l: Number(r[1]), h: Number(r[2]), o: Number(r[3]), c: Number(r[4]) }));
          const filtered = filterSettlementCandles(candles, start, end, interval.seconds);
          if (filtered.length) return { candles: filtered, source: `Coinbase ${base}/USD · ${interval.binance} candles` };
        }
      }
    } catch { /* Explicit unavailable state below. */ }
    return { candles: [], source: null };
  });