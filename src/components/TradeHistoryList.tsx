import { useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { TradeCloseSummary } from "@/components/TradeCloseSummary";
import {
  buildContractSummary,
  buildPositionSummary,
  type TradeSummary,
} from "@/lib/trade-summary";
import type { PositionRow } from "@/components/PositionsTable";
import type { ContractRow } from "@/lib/contracts.functions";

export type HistoryEntry = {
  key: string;
  kind: "position" | "contract";
  symbol: string;
  displaySymbol: string;
  sideLabel: string;
  isLong: boolean;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  size: number;
  currency: string;
  pnl: number;
  pnlPct: number;
  openedAt: string;
  closedAt: string;
  summary: TradeSummary;
};

function durationLabel(openedAt: string, closedAt: string) {
  const s = Math.max(0, Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

/** Merges closed leveraged positions and settled scalp contracts into one report list. */
export function buildHistory(positions: PositionRow[], contracts: ContractRow[]): HistoryEntry[] {
  const fromPositions = positions
    .filter((p) => p.status === "closed" && p.exitPrice != null)
    .map<HistoryEntry>((p) => {
      const pnl = p.realizedPnl ?? 0;
      const margin = (p.entryPrice * p.quantity) / Math.max(p.leverage, 1);
      return {
        key: `pos-${p.id}`,
        kind: "position",
        symbol: p.symbol,
        displaySymbol: p.displaySymbol,
        sideLabel: p.side === "long" ? "Buy / Long" : "Sell / Short",
        isLong: p.side === "long",
        leverage: p.leverage,
        entryPrice: p.entryPrice,
        exitPrice: p.exitPrice ?? 0,
        size: margin,
        currency: p.currency,
        pnl,
        pnlPct: margin > 0 ? (pnl / margin) * 100 : 0,
        openedAt: p.openedAt,
        closedAt: p.closedAt ?? p.openedAt,
        summary: buildPositionSummary({
          id: p.id,
          symbol: p.symbol,
          displaySymbol: p.displaySymbol,
          side: p.side,
          quantity: p.quantity,
          entryPrice: p.entryPrice,
          exitPrice: p.exitPrice ?? p.entryPrice,
          leverage: p.leverage,
          currency: p.currency,
          pnl,
          openedAt: p.openedAt,
          closedAt: p.closedAt ?? p.openedAt,
        }),
      };
    });

  const fromContracts = contracts
    .filter((c) => c.status === "settled" && c.exitPrice != null)
    .map<HistoryEntry>((c) => {
      const pnl = (c.payout ?? 0) - c.stake;
      return {
        key: `ctr-${c.id}`,
        kind: "contract",
        symbol: c.symbol,
        displaySymbol: c.displaySymbol,
        sideLabel: c.direction === "up" ? "Buy / Long" : "Sell / Short",
        isLong: c.direction === "up",
        leverage: 1,
        entryPrice: c.entryPrice,
        exitPrice: c.exitPrice ?? 0,
        size: c.stake,
        currency: c.currency,
        pnl,
        pnlPct: c.stake > 0 ? (pnl / c.stake) * 100 : 0,
        openedAt: c.openedAt,
        closedAt: c.settledAt ?? c.expiresAt,
        summary: buildContractSummary({
          id: c.id,
          symbol: c.symbol,
          displaySymbol: c.displaySymbol,
          direction: c.direction,
          stake: c.stake,
          currency: c.currency,
          entryPrice: c.entryPrice,
          exitPrice: c.exitPrice ?? c.entryPrice,
          payout: c.payout ?? 0,
          result: (c.result ?? "draw") as "win" | "loss" | "draw",
          openedAt: c.openedAt,
          closedAt: c.settledAt ?? c.expiresAt,
        }),
      };
    });

  return [...fromPositions, ...fromContracts].sort((a, b) => (a.closedAt < b.closedAt ? 1 : -1));
}

export function TradeHistoryList({
  positions,
  contracts,
  isLoading,
}: {
  positions: PositionRow[];
  contracts: ContractRow[];
  isLoading?: boolean;
}) {
  const entries = useMemo(() => buildHistory(positions, contracts), [positions, contracts]);
  const [active, setActive] = useState<TradeSummary | null>(null);

  if (!isLoading && entries.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-muted-foreground">
        No closed trades yet. Executed trades appear here with a full performance report.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border/60">
      {active && <TradeCloseSummary summary={active} onClose={() => setActive(null)} />}
      {entries.map((e) => {
        const positive = e.pnl >= 0;
        return (
          <button
            key={e.key}
            onClick={() => setActive(e.summary)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
          >
            <AssetIcon symbol={e.symbol} currency={e.symbol} size={30} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{e.displaySymbol}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    e.isLong ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                  }`}
                >
                  {e.sideLabel}
                </span>
                {e.leverage > 1 && (
                  <span className="num rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold">
                    {e.leverage}x
                  </span>
                )}
                <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {e.kind === "contract" ? "Scalp contract" : "Position"}
                </span>
              </div>
              <div className="num mt-0.5 truncate text-[11px] text-muted-foreground">
                {formatPrice(e.entryPrice, e.symbol)} → {formatPrice(e.exitPrice, e.symbol)} ·{" "}
                {formatMoney(e.size, e.currency)} ·{" "}
                <Clock className="inline size-3 -translate-y-px" />{" "}
                {durationLabel(e.openedAt, e.closedAt)} · {new Date(e.closedAt).toLocaleString()}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div
                className={`num rounded-md px-2 py-1 text-sm font-bold ${
                  positive ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                }`}
              >
                {positive ? "+" : ""}
                {formatMoney(e.pnl, e.currency)}
              </div>
              <div className={`num text-[11px] ${positive ? "text-bull" : "text-bear"}`}>
                {positive ? "+" : ""}
                {e.pnlPct.toFixed(2)}%
              </div>
            </div>
          </button>
        );
      })}

    </div>
  );
}
