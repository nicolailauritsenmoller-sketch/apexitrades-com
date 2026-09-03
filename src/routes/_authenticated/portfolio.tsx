import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AssetIcon } from "@/lib/asset-icons";
import { PositionsTable, unrealizedPnl, type PositionRow } from "@/components/PositionsTable";
import { useQuotes } from "@/hooks/useMarket";
import { getPortfolio } from "@/lib/trading.functions";
import { getPortfolioValue } from "@/lib/wallet.functions";
import { AssetsOverview } from "@/components/AssetsOverview";
import { BalancePrivacyToggle, useBalancePrivacy } from "@/lib/balance-privacy";
import { TradeHistoryList } from "@/components/TradeHistoryList";
import { getContracts } from "@/lib/contracts.functions";
import { formatMoney } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio — Velocity Trade" },
      {
        name: "description",
        content:
          "Track multi-currency wallets, open positions and realized P&L across crypto, stocks, futures, forex and gold.",
      },
      { property: "og:title", content: "Portfolio — Velocity Trade" },
      {
        property: "og:description",
        content: "Your multi-currency trading balances and live position P&L.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Portfolio,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Portfolio() {
  const fetchPortfolio = useServerFn(getPortfolio);
  const { data, isLoading } = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 15_000,
  });

  const fetchValue = useServerFn(getPortfolioValue);
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 30_000,
  });

  const fetchContracts = useServerFn(getContracts);
  const contracts = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    refetchInterval: 30_000,
  });

  const positions = (data?.positions ?? []) as PositionRow[];
  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const { quotes } = useQuotes(Array.from(new Set(open.map((p) => p.symbol))), 5000);

  const unrealizedByCurrency: Record<string, number> = {};
  for (const p of open) {
    const pnl = unrealizedPnl(p, quotes[p.symbol]?.price);
    if (pnl != null) {
      unrealizedByCurrency[p.currency] = (unrealizedByCurrency[p.currency] ?? 0) + pnl;
    }
  }
  const { hidden: balancesHidden, toggle: toggleBalances } = useBalancePrivacy();
  const realized = closed.reduce((sum, p) => sum + (p.realizedPnl ?? 0), 0);
  const totalUnrealized = Object.values(unrealizedByCurrency).reduce((a, b) => a + b, 0);
  const available = value.data?.wallets?.reduce(
    (sum: number, w: any) => sum + Number(w.availableUsdt ?? w.usdtValue ?? 0),
    0,
  );

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-bold sm:text-2xl">Portfolio</h1>
        <p className="text-sm text-muted-foreground">Overview of your assets and performance.</p>
      </div>

      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">Total portfolio value</div>
            <div className="num mt-1 text-3xl font-bold tracking-tight">
              {value.isLoading ? (
                "—"
              ) : balancesHidden ? (
                "••••••"
              ) : (
                <>
                  {(value.data?.totalUsdt ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  <span className="ml-1.5 text-base font-semibold text-muted-foreground">USDT</span>
                </>
              )}
            </div>
            <div
              className={`num mt-1 text-sm font-semibold ${totalUnrealized >= 0 ? "text-bull" : "text-bear"}`}
            >
              {balancesHidden
                ? "••••"
                : `${totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)} unrealized`}
            </div>
          </div>
          <BalancePrivacyToggle hidden={balancesHidden} onToggle={toggleBalances} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MiniStat label="Open positions" value={String(open.length)} />
          <MiniStat
            label="Unrealized P&L"
            value={
              balancesHidden
                ? "••••"
                : `${totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}`
            }
            tone={totalUnrealized >= 0 ? "bull" : "bear"}
          />
          <MiniStat
            label="Realized P&L"
            value={balancesHidden ? "••••" : `${realized >= 0 ? "+" : ""}${realized.toFixed(2)}`}
            tone={realized >= 0 ? "bull" : "bear"}
          />
          <MiniStat
            label="Available"
            value={
              balancesHidden || available == null ? "••••" : `${(available ?? 0).toFixed(2)} USDT`
            }
          />
        </div>
      </section>

      <div className="mt-6">
        <AssetsOverview
          holdings={value.data?.wallets ?? []}
          totalUsdt={value.data?.totalUsdt ?? 0}
          isLoading={value.isLoading}
        />
      </div>

      {Object.keys(unrealizedByCurrency).length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Object.entries(unrealizedByCurrency).map(([currency, pnl]) => (
            <div key={currency} className="panel p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                <AssetIcon currency={currency} size={22} />
                {currency}
              </div>
              <div
                className={`num mt-1.5 text-lg font-semibold ${pnl >= 0 ? "text-bull" : "text-bear"}`}
              >
                {balancesHidden ? "••••••" : `${pnl >= 0 ? "+" : ""}${formatMoney(pnl, currency)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Open positions
      </h2>
      <div className="panel overflow-x-auto">
        <PositionsTable
          positions={open}
          quotes={quotes}
          emptyLabel="No open positions. Head to the terminal to place your first trade."
        />
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Trade history
      </h2>
      <div className="panel mb-10 overflow-hidden">
        <TradeHistoryList
          positions={closed}
          contracts={contracts.data ?? []}
          isLoading={contracts.isLoading || isLoading}
        />
      </div>
    </AppShell>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`num mt-1 text-sm font-bold ${
          tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
