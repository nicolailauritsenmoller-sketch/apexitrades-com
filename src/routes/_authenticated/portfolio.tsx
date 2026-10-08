import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useDisplayCurrency } from "@/lib/display-currency";
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
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getDailyRealizedPnl, msUntilUtcMidnight } from "@/lib/pnl.functions";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { PortfolioPerformance, type Range } from "@/components/portfolio/PortfolioPerformance";
import { AssetAllocation } from "@/components/portfolio/AssetAllocation";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({
    meta: [
      { title: "Portfolio - Velocity Trade" },
      {
        name: "description",
        content:
          "Track multi-currency wallets, open positions and realized P&L across crypto, stocks, futures, forex and gold.",
      },
      { property: "og:title", content: "Portfolio - Velocity Trade" },
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
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Portfolio() {
  useWalletRealtime("portfolio-live");
  const qc = useQueryClient();
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

  // Settled performance booked inside the active UTC calendar day; the window
  // is bounded server-side, so the metric resets itself at 00:00:00 UTC.
  const fetchDailyPnl = useServerFn(getDailyRealizedPnl);
  const dailyPnl = useQuery({
    queryKey: ["daily-pnl"],
    queryFn: () => fetchDailyPnl(),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    const timer = setTimeout(
      () => qc.invalidateQueries({ queryKey: ["daily-pnl"] }),
      msUntilUtcMidnight() + 1_000,
    );
    return () => clearTimeout(timer);
  }, [qc, dailyPnl.dataUpdatedAt]);
  const todayRealized = dailyPnl.data?.realized ?? 0;

  const positions = (data?.positions ?? []) as PositionRow[];
  const open = positions.filter((p) => p.status === "open");
  const closed = positions.filter((p) => p.status === "closed");
  const { quotes } = useQuotes(Array.from(new Set(open.map((p) => p.symbol))), 2000);

  // When a contract settles, wallet balances change - refresh valuation.
  const settledCount = (contracts.data ?? []).filter((c: any) => c.status === "settled").length;
  useEffect(() => {
    qc.invalidateQueries({ queryKey: ["portfolio-value"] });
    qc.invalidateQueries({ queryKey: ["daily-pnl"] });
  }, [qc, settledCount]);

  const unrealizedByCurrency: Record<string, number> = {};
  for (const p of open) {
    const pnl = unrealizedPnl(p, quotes[p.symbol]?.price);
    if (pnl != null) {
      unrealizedByCurrency[p.currency] = (unrealizedByCurrency[p.currency] ?? 0) + pnl;
    }
  }
  const { hidden: balancesHidden, toggle: toggleBalances } = useBalancePrivacy();
  const display = useDisplayCurrency();
  const [range, setRange] = useState<Range>("1M");
  const [depositOpen, setDepositOpen] = useState(false);
  const realized = closed.reduce((sum, p) => sum + (p.realizedPnl ?? 0), 0);
  const totalUnrealized = Object.values(unrealizedByCurrency).reduce((a, b) => a + b, 0);
  const liveTotal = (value.data?.totalUsdt ?? 0) + totalUnrealized;
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

      <section className="panel touch-manipulation p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">
              Est. Total Value ({display.currency})
            </div>
            <div className="num mt-1 text-3xl font-bold tracking-tight">
              {value.isLoading ? (
                "-"
              ) : balancesHidden ? (
                "••••••"
              ) : (
                display.format(liveTotal)
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              Includes live mark-to-market on open positions
            </div>
          </div>
          <BalancePrivacyToggle hidden={balancesHidden} onToggle={toggleBalances} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <ArrowDownToLine className="size-4" /> Deposit
          </button>
          <Link
            to="/wallet"
            search={{ tab: "withdraw" }}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary/70"
          >
            <ArrowUpFromLine className="size-4" /> Withdraw
          </Link>
          <Link
            to="/wallet"
            search={{ tab: "swap" }}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2.5 text-xs font-semibold transition-colors hover:bg-secondary/70"
          >
            <Repeat className="size-4" /> Swap / Convert
          </Link>
        </div>

        <PortfolioPerformance
          total={liveTotal}
          drift={realized + totalUnrealized}
          range={range}
          onRangeChange={setRange}
          hidden={balancesHidden}
        />
      </section>
      <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />

      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <PnlCard
          label="Today's Realized P&L"
          hint="Settled today (00:00-23:59 UTC)"
          amount={todayRealized}
          loading={dailyPnl.isLoading}
          hidden={balancesHidden}
          format={display.format}
        />
        <PnlCard
          label="Total Unrealized P&L"
          hint="Live mark-to-market on open exposure"
          amount={totalUnrealized}
          loading={isLoading}
          hidden={balancesHidden}
          format={display.format}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <MiniStat label="Open Positions" value={String(open.length)} sub="View" subTo="#positions" />
        <MiniStat
          label="Unrealized P&L"
          value={
            balancesHidden ? "••••" : display.formatSigned(totalUnrealized)
          }
          sub={display.currency}
          tone={totalUnrealized >= 0 ? "bull" : "bear"}
        />
        <MiniStat
          label="Available Balance"
          value={balancesHidden || available == null ? "••••" : display.format(available ?? 0)}
          sub={display.currency}
        />
        <MiniStat
          label="Realized P&L"
          value={balancesHidden ? "••••" : display.formatSigned(realized)}
          sub={display.currency}
          tone={realized >= 0 ? "bull" : "bear"}
        />
      </div>

      <div className="mt-3">
        <AssetAllocation
          holdings={value.data?.wallets ?? []}
          total={value.data?.totalUsdt ?? 0}
          hidden={balancesHidden}
        />
      </div>

      <div className="mt-3">
        <AssetsOverview
          holdings={value.data?.wallets ?? []}
          totalUsdt={value.data?.totalUsdt ?? 0}
          formatValue={display.format}
          isLoading={value.isLoading}
          hidden={balancesHidden}
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


      <h2
        id="positions"
        className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground"
      >
        Open positions
      </h2>
      <div className="panel overflow-x-auto">
        <PositionsTable
          positions={open}
          quotes={quotes}
          emptyLabel="No open positions. Head to the terminal to place your first trade."
          hidden={balancesHidden}
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
          hidden={balancesHidden}
        />
      </div>
    </AppShell>
  );
}

function PnlCard({
  label,
  hint,
  amount,
  loading,
  hidden,
  format,
}: {
  label: string;
  hint: string;
  amount: number;
  loading?: boolean;
  hidden?: boolean;
  format: (usdt: number) => string;
}) {
  const positive = amount >= 0;
  return (
    <div className="panel touch-manipulation p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div
        className={`num mt-1 text-2xl font-bold tracking-tight ${positive ? "text-bull" : "text-bear"}`}
      >
        {loading
          ? "-"
          : hidden
            ? "••••••"
            : `${positive ? "+" : "-"}${format(Math.abs(amount))}`}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
  sub,
  subTo,
}: {
  label: string;
  value: string;
  tone?: "bull" | "bear";
  sub?: string;
  subTo?: string;
}) {
  return (
    <div className="touch-manipulation rounded-xl border border-border bg-surface p-3 text-center">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div
        className={`num mt-1 text-base font-bold ${
          tone === "bull" ? "text-bull" : tone === "bear" ? "text-bear" : ""
        }`}
      >
        {value}
      </div>
      {sub &&
        (subTo ? (
          <a href={subTo} className="mt-0.5 block text-[11px] font-semibold text-primary">
            {sub}
          </a>
        ) : (
          <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
        ))}
    </div>
  );
}

