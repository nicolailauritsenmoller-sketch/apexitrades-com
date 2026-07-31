import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Wallet, TrendingUp, Activity } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AssetIcon } from "@/lib/asset-icons";
import { PositionsTable, unrealizedPnl, type PositionRow } from "@/components/PositionsTable";
import { useQuotes } from "@/hooks/useMarket";
import { getPortfolio } from "@/lib/trading.functions";
import { formatMoney } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Portfolio — Velocity Terminal" },
      {
        name: "description",
        content:
          "Track multi-currency paper wallets, open positions and realized P&L across crypto, stocks, futures, forex and gold.",
      },
      { property: "og:title", content: "Portfolio — Velocity Terminal" },
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
            Multi-currency paper balances settled per instrument currency.
          </p>
        </div>
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
          value={`${totalUnrealized >= 0 ? "+" : ""}${totalUnrealized.toFixed(2)}`}
          tone={totalUnrealized >= 0 ? "bull" : "bear"}
        />
        <StatCard
          icon={<Wallet className="size-4 text-primary" />}
          label="Realized P&L"
          value={`${realized >= 0 ? "+" : ""}${realized.toFixed(2)}`}
          tone={realized >= 0 ? "bull" : "bear"}
        />
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Wallets
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(data?.wallets ?? []).map((w) => (
          <div key={w.currency} className="panel p-4">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              <AssetIcon currency={w.currency} size={22} />
              {w.currency}
            </div>
            <div className="num mt-1.5 text-lg font-semibold">
              {formatMoney(w.balance, w.currency)}
            </div>
            {unrealizedByCurrency[w.currency] != null && (
              <div
                className={`num mt-1 text-xs ${
                  unrealizedByCurrency[w.currency] >= 0 ? "text-bull" : "text-bear"
                }`}
              >
                {unrealizedByCurrency[w.currency] >= 0 ? "+" : ""}
                {unrealizedByCurrency[w.currency].toFixed(2)} open
              </div>
            )}
          </div>
        ))}
        {isLoading && <div className="panel p-4 text-sm text-muted-foreground">Loading…</div>}
      </div>

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
      <div className="panel mb-10">
        <PositionsTable positions={closed} quotes={quotes} emptyLabel="No closed trades yet." />
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
