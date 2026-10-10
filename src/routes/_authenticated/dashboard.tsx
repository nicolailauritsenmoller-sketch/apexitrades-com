import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AccountMetrics, useAccountOverview } from "@/components/home/AccountMetrics";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { KycDashboardCard } from "@/components/home/KycDashboardCard";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine, ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BalancePrivacyToggle, useBalancePrivacy } from "@/lib/balance-privacy";
import { useT } from "@/lib/i18n";
import { getPortfolioValue } from "@/lib/wallet.functions";
import { useDailyPnl } from "@/hooks/useDailyPnl";
import { useDisplayCurrency } from "@/lib/display-currency";
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
      { title: "Home - Velocity Trade" },
      {
        name: "description",
        content:
          "Your total balance, watchlist, and top market movers in one mobile-first trading home screen.",
      },
      { property: "og:title", content: "Home - Velocity Trade" },
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
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Home() {
  const t = useT();
  useWalletRealtime("dashboard-wallet-live");
  const [depositOpen, setDepositOpen] = useState(false);
  const overview = useAccountOverview();
  const fetchValue = useServerFn(getPortfolioValue);
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 10_000,
  });

  const { pnl: todayPnl } = useDailyPnl(value.data?.wallets ?? []);

  const { hidden, toggle } = useBalancePrivacy();
  const { currency, convert, format } = useDisplayCurrency();
  const total = value.data?.totalUsdt ?? 0;
  const baseline = total - todayPnl;
  const pct = baseline > 0 ? (todayPnl / baseline) * 100 : 0;

  const pnlSign = todayPnl >= 0 ? "+" : "-";
  const pctSign = pct >= 0 ? "+" : "";
  const convertedPnl = Math.abs(convert(todayPnl));
  const pnlDecimals = convertedPnl > 0 && convertedPnl < 0.01 ? 8 : undefined;

  return (
    <AppShell>
      {/* Balance hero */}
      <section className="panel p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Est. Total Value ({currency})</span>
              <ChevronDown className="size-3.5" />
              <BalancePrivacyToggle hidden={hidden} onToggle={toggle} className="ml-0.5" />
            </div>

            <div className="num mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
              {value.isLoading ? (
                "-"
              ) : hidden ? (
                "••••••"
              ) : (
                format(total)
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
                : `${pnlSign}${format(Math.abs(todayPnl), { decimals: pnlDecimals })} (${pctSign}${pct.toFixed(2)}%)`}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDepositOpen(true)}
            className="flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
            style={{ boxShadow: "var(--glow-primary)" }}
          >
            <ArrowDownToLine className="size-4" strokeWidth={2.6} />
            {t("dashboard.addFunds")}
          </button>
        </div>
      </section>

      <KycDashboardCard />

      <AccountMetrics data={overview.data} hidden={hidden} format={(v) => format(v)} />

      <WatchlistSection />
      <TopMoversSection />

      <ExploreTokensSection />
      <DiscoverPerpsSection />
      <MarketNewsSection />
      <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
    </AppShell>
  );
}
