import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { useWalletRealtime } from "@/lib/use-wallet-realtime";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BalancePrivacyToggle, useBalancePrivacy } from "@/lib/balance-privacy";
import { useT } from "@/lib/i18n";
import { getPortfolioValue } from "@/lib/wallet.functions";
import { useDailyPnl } from "@/hooks/useDailyPnl";
import { useDisplayCurrency } from "@/lib/display-currency";
import { ExchangeMarkets } from "@/components/home/ExchangeMarkets";
import { ExchangeWidgets } from "@/components/home/ExchangeWidgets";
import { ExchangeSearch } from "@/components/home/ExchangeSearch";
import { ExchangeDiscover } from "@/components/home/ExchangeDiscover";
import { Button } from "@/components/ui/button";

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
  const [search, setSearch] = useState("");
  const fetchValue = useServerFn(getPortfolioValue);
  const value = useQuery({
    queryKey: ["portfolio-value"],
    queryFn: () => fetchValue(),
    refetchInterval: 10_000,
  });

  const { pnl: todayPnl } = useDailyPnl(value.data?.wallets ?? []);

  const { hidden, toggle } = useBalancePrivacy();
  const { currency, convert, format } = useDisplayCurrency("USD");
  const total = value.data?.totalUsdt ?? 0;
  const baseline = total - todayPnl;
  const pct = baseline > 0 ? (todayPnl / baseline) * 100 : 0;

  const pnlSign = todayPnl >= 0 ? "+" : "-";
  const pctSign = pct >= 0 ? "+" : "";
  const convertedPnl = Math.abs(convert(todayPnl));
  const pnlDecimals = convertedPnl > 0 && convertedPnl < 0.01 ? 8 : undefined;

  return (
    <AppShell exchangeHome>
      <div className="mx-auto w-full max-w-3xl space-y-4 touch-manipulation">
      <div className="flex justify-center">
        <div role="tablist" aria-label="Account mode" className="inline-flex rounded-full bg-surface-raised p-1 text-sm">
          <span role="tab" aria-selected="true" className="rounded-full bg-surface px-5 py-1.5 font-semibold">Exchange</span>
          <Link to="/assets" role="tab" aria-selected="false" className="rounded-full px-5 py-1.5 text-muted-foreground">Wallet</Link>
        </div>
      </div>
      <ExchangeSearch value={search} onChange={setSearch} />
      <section className="space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <span>Est. Total Value ({currency})</span>
          <ChevronDown className="size-3.5" />
          <BalancePrivacyToggle hidden={hidden} onToggle={toggle} className="ml-0.5" />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
          <div className="min-w-0 break-words text-3xl font-bold tabular-nums sm:text-4xl">
            {value.isLoading ? "-" : hidden ? "••••••" : format(total)}
          </div>
          <Button onClick={() => setDepositOpen(true)} className="min-h-10 shrink-0 touch-manipulation rounded-md px-4 text-sm font-semibold active:scale-[0.97]">
            {t("dashboard.addFunds")}
          </Button>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{t("dashboard.todaysPnl")}</span>
          <span className={`num font-semibold ${todayPnl >= 0 ? "text-bull" : "text-bear"}`}>
            {hidden ? "••••" : `${pnlSign}${format(Math.abs(todayPnl), { decimals: pnlDecimals })} (${pctSign}${pct.toFixed(2)}%)`}
          </span>
        </div>
      </section>
      <ExchangeWidgets onDeposit={() => setDepositOpen(true)} />
      <ExchangeMarkets search={search} />
      <ExchangeDiscover />
      </div>
      <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
    </AppShell>
  );
}
