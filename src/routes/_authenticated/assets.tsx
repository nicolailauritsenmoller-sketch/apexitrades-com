import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { AssetIcon } from "@/lib/asset-icons";
import { getPortfolio } from "@/lib/trading.functions";
import { getContracts } from "@/lib/contracts.functions";
import { useQuotes } from "@/hooks/useMarket";
import { INSTRUMENTS, displaySymbol, formatMoney, formatPrice } from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/assets")({
  head: () => ({
    meta: [
      { title: "Assets & wallets — Velocity Terminal" },
      {
        name: "description",
        content:
          "Track multi-currency paper balances in USD, EUR, GBP, USDT and BTC alongside your tradable instrument universe.",
      },
      { property: "og:title", content: "Assets & wallets — Velocity Terminal" },
      {
        property: "og:description",
        content: "Multi-currency wallets, open exposure and every tradable asset in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Assets,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function Assets() {
  const fetchPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 20_000,
  });

  const fetchContracts = useServerFn(getContracts);
  const contracts = useQuery({ queryKey: ["contracts"], queryFn: () => fetchContracts() });

  const wallets = portfolio.data?.wallets ?? [];
  const openPositions = (portfolio.data?.positions ?? []).filter((p) => p.status === "open");
  const { quotes } = useQuotes(
    openPositions.map((p) => p.symbol),
    10_000,
  );

  const openContracts = (contracts.data ?? []).filter((c) => c.status === "open");

  return (
    <AppShell>
      <h1 className="text-2xl font-bold">Assets</h1>
      <p className="mb-5 text-sm text-muted-foreground">
        Your multi-currency balances, live exposure and the full tradable universe.
      </p>

      <h2 className="mb-3 text-xs uppercase tracking-widest text-muted-foreground">Wallets</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {wallets.map((w) => (
          <div key={w.currency} className="panel flex items-center gap-3 p-4">
            <AssetIcon currency={w.currency} size={34} />
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {w.currency}
              </div>
              <div className="num truncate text-lg font-semibold">
                {formatMoney(w.balance, w.currency)}
              </div>
            </div>
          </div>
        ))}
        {portfolio.isLoading && (
          <div className="panel p-4 text-sm text-muted-foreground">Loading…</div>
        )}
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Current exposure
      </h2>
      <div className="panel divide-y divide-border">
        {openPositions.length === 0 && openContracts.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No open exposure right now.
          </p>
        )}
        {openPositions.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <AssetIcon symbol={p.symbol} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.displaySymbol}</div>
              <div className="text-[11px] uppercase text-muted-foreground">
                {p.side} · {p.leverage}x
              </div>
            </div>
            <div className="num text-right text-sm">
              {quotes[p.symbol] ? formatPrice(quotes[p.symbol].price, p.symbol) : "—"}
            </div>
          </div>
        ))}
        {openContracts.map((c) => (
          <div key={c.id} className="flex items-center gap-3 px-4 py-3">
            <AssetIcon symbol={c.symbol} size={28} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{c.displaySymbol}</div>
              <div className="text-[11px] uppercase text-muted-foreground">
                Timed contract · {c.direction === "up" ? "higher" : "lower"}
              </div>
            </div>
            <div className="num text-right text-sm">{formatMoney(c.stake, c.currency)}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Tradable assets
      </h2>
      <div className="mb-10 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {INSTRUMENTS.map((i) => (
          <Link
            key={i.symbol}
            to="/terminal/$symbol"
            params={{ symbol: i.symbol }}
            className="panel flex items-center gap-3 p-3 transition-colors hover:bg-secondary"
          >
            <AssetIcon symbol={i.symbol} size={28} />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{displaySymbol(i.symbol)}</div>
              <div className="truncate text-[11px] text-muted-foreground">{i.name}</div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
