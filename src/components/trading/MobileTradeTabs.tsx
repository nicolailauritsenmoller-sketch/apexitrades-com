import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Timer, Wallet } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { PositionsTable, type PositionRow } from "@/components/PositionsTable";
import { formatMoney, formatPrice } from "@/lib/instruments";
import type { Quote } from "@/lib/market-types";
import { getContracts, type ContractRow } from "@/lib/contracts.functions";
import { formatCountdown } from "@/lib/contract-tiers";
import { buildContractSummary, type TradeSummary } from "@/lib/trade-summary";
import { TradeCloseSummary } from "@/components/TradeCloseSummary";
import { LivePnl } from "@/components/LivePnl";

type Tab = "positions" | "orders" | "history" | "assets";

export type WalletRow = { currency: string; balance: number };

/**
 * Mobile consolidated activity panel: positions, orders, history and
 * tradeable balances in a single tabbed card below the execution stack.
 */
export function MobileTradeTabs({
  openPositions,
  orders,
  history,
  wallets,
  quotes,
}: {
  openPositions: PositionRow[];
  orders: PositionRow[];
  history: PositionRow[];
  wallets: WalletRow[];
  quotes: Record<string, Quote>;
}) {
  const [tab, setTab] = useState<Tab>("positions");
  const [summary, setSummary] = useState<TradeSummary | null>(null);

  const fetchContracts = useServerFn(getContracts);
  const contracts = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    refetchInterval: 15_000,
  });
  const settled = (contracts.data ?? [])
    .filter((c) => c.status === "settled")
    .slice(0, 10);
  const runningContracts = (contracts.data ?? []).filter((c) => c.status === "open");

  // Live ticker for running scalp contract countdowns.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (runningContracts.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [runningContracts.length]);

  const funded = wallets.filter((w) => w.balance > 0);
  const usdt = wallets.find((w) => w.currency === "USDT");

  const tabs: { id: Tab; label: string }[] = [
    {
      id: "positions",
      label: `Open Positions (${openPositions.length + runningContracts.length})`,
    },
    { id: "orders", label: `Open Orders (${orders.length})` },
    { id: "history", label: "History" },
    { id: "assets", label: "Assets" },
  ];

  return (
    <section className="mt-4">
      {summary && (
        <TradeCloseSummary summary={summary} onClose={() => setSummary(null)} />
      )}

      <div className="-mx-1 flex gap-4 overflow-x-auto border-b border-border px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`shrink-0 touch-manipulation border-b-2 pb-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel mt-3 overflow-x-auto">
        {tab === "positions" && (
          <PositionsTable
            positions={openPositions}
            quotes={quotes}
            emptyLabel="No open positions."
          />
        )}

        {tab === "orders" && (
          <PositionsTable
            positions={orders}
            quotes={quotes}
            emptyLabel="No open orders on this instrument."
          />
        )}

        {tab === "history" && (
          <div className="divide-y divide-border">
            {settled.length > 0 && (
              <ul className="space-y-1.5 p-3 text-xs">
                {settled.map((c) => {
                  const net = (c.payout ?? 0) - c.stake;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSummary(
                            buildContractSummary({
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
                          )
                        }
                        className="flex w-full touch-manipulation items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-secondary/60"
                      >
                        <span className="truncate text-muted-foreground">
                          {c.displaySymbol} ·{" "}
                          {c.direction === "up" ? "Call / Higher" : "Put / Lower"}
                        </span>
                        <LivePnl value={net} currency={c.currency} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {history.length > 0 || settled.length > 0 ? (
              <PositionsTable
                positions={history}
                quotes={quotes}
                emptyLabel=""
              />
            ) : (
              <p className="p-4 text-xs text-muted-foreground">
                No settled trades yet.
              </p>
            )}
          </div>
        )}

        {tab === "assets" && (
          <div className="p-3">
            <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <Wallet className="size-3.5" /> Tradeable balance
              </span>
              <span className="num text-sm font-semibold">
                {usdt ? formatMoney(usdt.balance, "USDT") : "—"}
              </span>
            </div>
            {funded.length === 0 ? (
              <p className="py-2 text-xs text-muted-foreground">
                No funded wallets yet. Deposit to start trading.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {funded.map((w) => (
                  <li
                    key={w.currency}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2 font-medium">
                      <AssetIcon symbol={w.currency} size={18} />
                      <span className="truncate">{w.currency}</span>
                    </span>
                    <span className="num shrink-0">
                      {formatMoney(w.balance, w.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
