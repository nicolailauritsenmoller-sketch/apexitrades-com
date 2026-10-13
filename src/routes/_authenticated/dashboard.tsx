import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAccountOverview } from "@/components/home/AccountMetrics";
import { ActiveTradingPositions, TradingRiskOverview } from "@/components/home/TradingOverview";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Home - Velocity Trade" },
      {
        name: "description",
        content:
          "Monitor account valuation, committed margin, leveraged exposure and open trading positions.",
      },
      { property: "og:title", content: "Home - Velocity Trade" },
      {
        property: "og:description",
        content: "Account valuation, margin risk and open margin and scalp positions at a glance.",
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
  const { currency, format } = useDisplayCurrency();
  const total = value.data?.totalUsdt ?? 0;
  const baseline = total - todayPnl;
  const pct = baseline > 0 ? (todayPnl / baseline) * 100 : null;

  const pnlSign = todayPnl >= 0 ? "+" : "-";
  const pctText = pct == null ? "N/A" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

  return (
    <AppShell>
      <h1 className="mb-5 text-xl font-semibold">Trading overview</h1>
      <section aria-label="Account valuation" className="border-t border-border pt-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span>Estimated account value ({currency})</span>
              <BalancePrivacyToggle hidden={hidden} onToggle={toggle} className="ml-0.5" />
            </div>

            <div className="num mt-2 break-words text-2xl font-semibold sm:text-3xl">
              {!value.data ? (
                "-"
              ) : hidden ? (
                "••••••"
              ) : (
                format(total)
              )}
            </div>

            <div className="mt-2 flex items-center gap-1 text-xs font-medium text-muted-foreground">
              <span>{t("dashboard.todaysPnl")} (UTC)</span>
            </div>
            <div
              className={`num text-sm font-semibold ${todayPnl >= 0 ? "text-bull" : "text-bear"}`}
            >
              {!value.data ? "-" : hidden
                ? "••••"
                : `${pnlSign}${format(Math.abs(todayPnl))} (${pctText})`}
            </div>
          </div>

          <Button
            type="button"
            onClick={() => setDepositOpen(true)}
            variant="outline"
            className="min-h-11 touch-manipulation"
          >
            <ArrowDownToLine className="size-4" strokeWidth={2.6} />
            {t("dashboard.addFunds")}
          </Button>
        </div>
      </section>

      <TradingRiskOverview data={overview.data} failed={overview.isError} hidden={hidden} format={format} />
      <ActiveTradingPositions hidden={hidden} />

      <WatchlistSection />
      <TopMoversSection />

      <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
    </AppShell>
  );
}
