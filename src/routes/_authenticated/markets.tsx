import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useQuotes } from "@/hooks/useMarket";
import {
  ASSET_CLASS_LABEL,
  INSTRUMENTS,
  displaySymbol,
  formatPrice,
  type AssetClass,
} from "@/lib/instruments";

export const Route = createFileRoute("/_authenticated/markets")({
  head: () => ({
    meta: [
      { title: "Markets — Velocity Terminal" },
      {
        name: "description",
        content:
          "Browse live prices for crypto pairs, US stocks, index futures, major forex pairs and precious metals in one terminal.",
      },
      { property: "og:title", content: "Markets — Velocity Terminal" },
      {
        property: "og:description",
        content: "Live quotes across five asset classes, updated every few seconds.",
      },
    ],
  }),
  component: Markets,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

const TABS: ("all" | AssetClass)[] = ["all", "crypto", "stock", "future", "forex", "metal"];

function Markets() {
  const [tab, setTab] = useState<"all" | AssetClass>("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      INSTRUMENTS.filter((i) => tab === "all" || i.assetClass === tab).filter((i) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return true;
        return (
          i.name.toLowerCase().includes(needle) ||
          displaySymbol(i.symbol).toLowerCase().includes(needle)
        );
      }),
    [tab, q],
  );

  const { quotes } = useQuotes(
    filtered.map((i) => i.symbol),
    8000,
  );

  return (
    <AppShell>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Markets</h1>
          <p className="text-sm text-muted-foreground">
            Live prices across crypto, stocks, futures, forex and metals.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search instruments"
            className="w-64 rounded-md border border-input bg-surface py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {t === "all" ? "All" : ASSET_CLASS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 text-left font-medium">Instrument</th>
              <th className="px-4 py-2.5 text-left font-medium">Class</th>
              <th className="px-4 py-2.5 text-right font-medium">Last</th>
              <th className="px-4 py-2.5 text-right font-medium">24h</th>
              <th className="px-4 py-2.5 text-right font-medium">High</th>
              <th className="px-4 py-2.5 text-right font-medium">Low</th>
              <th className="px-4 py-2.5 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const quote = quotes[i.symbol];
              const up = (quote?.changePercent ?? 0) >= 0;
              return (
                <tr key={i.symbol} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{displaySymbol(i.symbol)}</div>
                    <div className="text-[11px] text-muted-foreground">{i.name}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ASSET_CLASS_LABEL[i.assetClass]}
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {quote && !quote.stale ? formatPrice(quote.price, i.symbol) : "—"}
                  </td>
                  <td
                    className={`num px-4 py-3 text-right ${up ? "text-bull" : "text-bear"}`}
                  >
                    {quote && !quote.stale
                      ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {quote && !quote.stale ? formatPrice(quote.high, i.symbol) : "—"}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {quote && !quote.stale ? formatPrice(quote.low, i.symbol) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to="/terminal/$symbol"
                      params={{ symbol: i.symbol }}
                      className="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-secondary"
                    >
                      Trade
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
