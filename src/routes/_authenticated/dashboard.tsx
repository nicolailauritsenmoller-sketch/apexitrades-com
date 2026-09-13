import { createFileRoute } from "@tanstack/react-router";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { BalancePrivacyToggle, useBalancePrivacy } from "@/lib/balance-privacy";
import { getPortfolioValue } from "@/lib/wallet.functions";
import { getPortfolio } from "@/lib/trading.functions";
import { unrealizedPnl, type PositionRow } from "@/components/PositionsTable";
import { useQuotes } from "@/hooks/useMarket";
import {
  HomeActionBar,
  WatchlistSection,
  TopMoversSection,
} from "@/components/home/HomeSummary";
import {
  ExploreTokensSection,
  DiscoverPerpsSection,
  MarketNewsSection,
} from "@/components/home/DiscoverSections";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — Velocity Trade" },
      {
        name: "description",
        content:
          "Your total balance, watchlist, and top market movers in one mobile-first trading home screen.",
      },
      { property: "og:title", content: "Home — Velocity Trade" },
      {
        property: "og:description",
        content: "Balance, watchlist, and movers at a glance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Home() {
  useWalletRealtime("dashboard-wallet-live");
  const fetchValue = useServerFn(getPortfolioValue);
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 30_000,
  });

  const fetchPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 20_000,
  });

  const open = ((portfolio.data?.positions ?? []) as PositionRow[]).filter(
    (p) => p.status === "open",
  );
  const { quotes } = useQuotes(Array.from(new Set(open.map((p) => p.symbol))), 8000);
  const todayPnl = open.reduce((sum, p) => sum + (unrealizedPnl(p, quotes[p.symbol]?.price) ?? 0), 0);

  const { hidden, toggle } = useBalancePrivacy();
  const total = value.data?.totalUsdt ?? 0;
  const pct = total > 0 ? (todayPnl / total) * 100 : 0;

  return (
    <AppShell>
      {/* Balance hero */}
      <section className="panel p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-muted-foreground">Total balance</div>
            <div className="num mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {value.isLoading ? (
                "—"
              ) : hidden ? (
                "••••••"
              ) : (
                <>
                  {total.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                  <span className="ml-1.5 text-base font-semibold text-muted-foreground">USDT</span>
                </>
              )}
            </div>
            <div
              className={`num mt-1 text-sm font-semibold ${todayPnl >= 0 ? "text-bull" : "text-bear"}`}
            >
              {hidden
                ? "••••"
                : `${todayPnl >= 0 ? "+" : ""}${todayPnl.toFixed(2)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%) Today`}
            </div>
          </div>
          <BalancePrivacyToggle hidden={hidden} onToggle={toggle} />
        </div>

        <div className="mt-4">
          <HomeActionBar />
        </div>
      </section>

      <WatchlistSection />
      <TopMoversSection />
      <RecentActivitySection />

      <ExploreTokensSection />
      <DiscoverPerpsSection />
      <MarketNewsSection />
    </AppShell>
  );
}
