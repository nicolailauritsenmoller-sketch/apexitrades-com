import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp, Activity, ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import { Link } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
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
    ],
  }),
  component: Dashboard,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Dashboard() {
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

  return (
    <AppShell>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {data?.profile?.display_name ?? "Trader"}'s portfolio
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-currency balances settled per instrument currency.
          </p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Link
          to="/wallet"
          search={{ tab: "deposit" }}
          className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-transform active:scale-[0.98]"
        >
          <ArrowDownToLine className="size-5" strokeWidth={2.6} />
          Deposit
        </Link>
        <Link
          to="/wallet"
          search={{ tab: "withdraw" }}
          className="flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/20 transition-transform active:scale-[0.98]"
        >
          <ArrowUpFromLine className="size-5" strokeWidth={2.6} />
          Withdraw
        </Link>
        <Link
          to="/wallet"
          search={{ tab: "swap" }}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-transform active:scale-[0.98]"
        >
          <Repeat className="size-5" strokeWidth={2.6} />
          Swap
        </Link>
      </div>

      <div className="panel mb-4 flex items-start justify-between gap-3 p-5">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Total portfolio balance
          </div>
          <div className="num text-3xl font-bold">
            {value.isLoading
              ? "—"
              : balancesHidden
                ? "••••••"
                : `${(value.data?.totalUsdt ?? 0).toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDT`}
          </div>
        </div>
        <BalancePrivacyToggle hidden={balancesHidden} onToggle={toggleBalances} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          icon={<Activity className="size-4 text-primary" />}
          label="Open positions"
          value={String(open.length)}
        />
        <StatCard
          icon={<TrendingUp className="size-4 text-primary" />}
          label="Unrealized P&L"
          value={
            balancesHidden
              ? "••••"
              : `${totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}`
          }
          tone={totalUnrealized >= 0 ? "bull" : "bear"}
        />
        <StatCard
          icon={<Wallet className="size-4 text-primary" />}
          label="Realized P&L"
          value={balancesHidden ? "••••" : `${realized >= 0 ? "+" : ""}${realized.toFixed(2)}`}
          tone={realized >= 0 ? "bull" : "bear"}
        />
      </div>

      <div className="mt-8">
        <AssetsOverview
          holdings={value.data?.wallets ?? []}
          totalUsdt={value.data?.totalUsdt ?? 0}
          isLoading={value.isLoading}
        />
      </div>

      {Object.keys(unrealizedByCurrency).length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Object.entries(unrealizedByCurrency).map(([currency, pnl]) => (
            <div key={currency} className="panel p-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                <AssetIcon currency={currency} size={22} />
                {currency} open P&L
              </div>
              <div className={`num mt-1.5 text-lg font-semibold ${pnl >= 0 ? "text-bull" : "text-bear"}`}>
                {balancesHidden ? "••••••" : `${pnl >= 0 ? "+" : ""}${formatMoney(pnl, currency)}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Open positions
      </h2>
      <div className="panel">
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

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "bull" | "bear";
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`num mt-2 text-2xl font-semibold ${
          tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
