import { createFileRoute, Link } from "@tanstack/react-router";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BalancePrivacyToggle, useBalancePrivacy } from "@/lib/balance-privacy";
import { useT } from "@/lib/i18n";
import { getPortfolioValue } from "@/lib/wallet.functions";
import { useDailyPnl } from "@/hooks/useDailyPnl";
import {
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
  const t = useT();
  useWalletRealtime("dashboard-wallet-live");
  const fetchValue = useServerFn(getPortfolioValue);
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 30_000,
  });

  const { pnl: todayPnl } = useDailyPnl(value.data?.wallets ?? []);

  const { hidden, toggle } = useBalancePrivacy();
  const total = value.data?.totalUsdt ?? 0;
  const baseline = total - todayPnl;
  const pct = baseline > 0 ? (todayPnl / baseline) * 100 : 0;

  const pnlSign = todayPnl >= 0 ? "+" : "";
  const pctSign = pct >= 0 ? "+" : "";
  const pnlDecimals = Math.abs(todayPnl) > 0 && Math.abs(todayPnl) < 0.01 ? 8 : 2;

  return (
    <AppShell>
      {/* Balance hero */}
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>{t("dashboard.estTotalValue")}</span>
              <ChevronDown className="size-3.5" />
              <BalancePrivacyToggle hidden={hidden} onToggle={toggle} className="ml-0.5" />
            </div>

            <div className="num mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {value.isLoading ? (
                "—"
              ) : hidden ? (
                "••••••"
              ) : (
                `$${total.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>

            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span>{t("dashboard.todaysPnl")}</span>
              <ChevronDown className="size-3" />
            </div>
            <div
              className={`num text-sm font-semibold ${todayPnl >= 0 ? "text-bull" : "text-bear"}`}
            >
              {hidden
                ? "••••"
                : `${pnlSign}$${Math.abs(todayPnl).toLocaleString("en-US", {
                    minimumFractionDigits: pnlDecimals,
                    maximumFractionDigits: pnlDecimals,
                  })} (${pctSign}${pct.toFixed(2)}%)`}
            </div>
          </div>

          <Link
            to="/wallet"
            search={{ tab: "deposit" }}
            className="flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
            style={{ boxShadow: "var(--glow-primary)" }}
          >
            <ArrowDownToLine className="size-4" strokeWidth={2.6} />
            {t("dashboard.addFunds")}
          </Link>
        </div>
      </section>

      <WatchlistSection />
      <TopMoversSection />

      <ExploreTokensSection />
      <DiscoverPerpsSection />
      <MarketNewsSection />
    </AppShell>
  );
}
