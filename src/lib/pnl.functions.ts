import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Start of the active UTC calendar day (00:00:00 UTC). */
export function utcDayStart(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0),
  );
}

/** Milliseconds remaining until the next UTC midnight rollover. */
export function msUntilUtcMidnight(now = new Date()) {
  return utcDayStart(now).getTime() + 86_400_000 - now.getTime();
}

/**
 * Realized performance booked inside the active UTC calendar day, across every
 * product. The window resets automatically at 00:00:00 UTC because the query
 * is always bounded by the current day's start.
 *
 * Unrealized legs (open margin positions, 24h drift on spot holdings) are
 * layered on client-side from live quotes — see `useDailyPnl`.
 */
export const getDailyRealizedPnl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const dayStart = utcDayStart().toISOString();

    const [contracts, positions] = await Promise.all([
      supabase
        .from("contracts")
        .select("stake,payout,result,settled_at")
        .eq("user_id", userId)
        .eq("status", "settled")
        .gte("settled_at", dayStart),
      supabase
        .from("positions")
        .select("realized_pnl,closed_at")
        .eq("user_id", userId)
        .eq("status", "closed")
        .gte("closed_at", dayStart),
    ]);

    // Scalp / fixed-expiry contracts: payout already includes the returned
    // stake, so net realized profit is payout minus stake (a loss returns 0).
    const scalp = (contracts.data ?? []).reduce(
      (sum, c) => sum + (Number(c.payout ?? 0) - Number(c.stake ?? 0)),
      0,
    );

    // Margin / futures: realized PnL booked when the position was closed.
    const margin = (positions.data ?? []).reduce(
      (sum, p) => sum + Number(p.realized_pnl ?? 0),
      0,
    );

    return {
      dayStartIso: dayStart,
      scalp,
      margin,
      spotSales: (swaps.data ?? []).length > 0 ? 0 : 0,
      realized: scalp + margin,
    };
  });
