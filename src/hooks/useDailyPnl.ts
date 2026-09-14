import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDailyRealizedPnl, msUntilUtcMidnight } from "@/lib/pnl.functions";
import { getPortfolio } from "@/lib/trading.functions";
import { unrealizedPnl, type PositionRow } from "@/components/PositionsTable";
import { useQuotes } from "@/hooks/useMarket";

export type WalletValueRow = { currency: string; valueUsdt: number };

const NON_DRIFTING = new Set(["USD", "EUR", "GBP", "USDT", "USDC", "DAI", "TUSD", "FDUSD"]);

/** Market symbol used to read the 24h move of a held asset. */
function driftSymbol(currency: string) {
  if (NON_DRIFTING.has(currency)) return null;
  return `${currency}USDT`;
}

/**
 * Unified cross-product 24-hour PNL:
 *  - scalp / fixed-expiry contracts settled today (realized)
 *  - margin positions closed today (realized) + open positions (unrealized)
 *  - spot holdings (24h value drift of active balances)
 *
 * The realized window is bounded to the active UTC calendar day, so the figure
 * resets itself to $0.00 at 00:00:00 UTC. A timer refetches exactly at the
 * rollover, and realtime wallet/trade events push instant recalculations.
 */
export function useDailyPnl(wallets: WalletValueRow[]) {
  const qc = useQueryClient();
  const fetchRealized = useServerFn(getDailyRealizedPnl);

  const realizedQuery = useQuery({
    queryKey: ["daily-pnl"],
    queryFn: () => fetchRealized(),
    refetchInterval: 30_000,
  });

  // Fresh baseline the moment the UTC day rolls over.
  useEffect(() => {
    const timer = setTimeout(
      () => qc.invalidateQueries({ queryKey: ["daily-pnl"] }),
      msUntilUtcMidnight() + 1_000,
    );
    return () => clearTimeout(timer);
  }, [qc, realizedQuery.dataUpdatedAt]);

  const fetchPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 20_000,
  });

  const openPositions = ((portfolio.data?.positions ?? []) as PositionRow[]).filter(
    (p) => p.status === "open",
  );

  const driftCodes = wallets
    .filter((w) => w.valueUsdt > 0)
    .map((w) => driftSymbol(w.currency))
    .filter((s): s is string => Boolean(s));

  const symbols = Array.from(new Set([...openPositions.map((p) => p.symbol), ...driftCodes]));
  const { quotes } = useQuotes(symbols, 8000);

  const unrealizedMargin = openPositions.reduce(
    (sum, p) => sum + (unrealizedPnl(p, quotes[p.symbol]?.price) ?? 0),
    0,
  );

  const spotDrift = wallets.reduce((sum, w) => {
    const sym = driftSymbol(w.currency);
    const pct = sym ? quotes[sym]?.changePercent : undefined;
    if (!sym || pct == null || !Number.isFinite(pct)) return sum;
    const previous = w.valueUsdt / (1 + pct / 100);
    return sum + (w.valueUsdt - previous);
  }, 0);

  const realizedScalp = realizedQuery.data?.scalp ?? 0;
  const realizedMargin = realizedQuery.data?.margin ?? 0;
  const pnl = realizedScalp + realizedMargin + unrealizedMargin + spotDrift;

  return {
    pnl,
    breakdown: { realizedScalp, realizedMargin, unrealizedMargin, spotDrift },
    isLoading: realizedQuery.isLoading,
  };
}
