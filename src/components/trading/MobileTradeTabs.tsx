import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AssetIcon } from "@/lib/asset-icons";
import { PositionsTable, type PositionRow } from "@/components/PositionsTable";
import { displaySymbol, formatPrice, type Instrument } from "@/lib/instruments";
import type { Quote } from "@/lib/market-types";

type Tab = "orders" | "holdings" | "bots";

function volume(n?: number) {
  if (!n) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

/** Mobile lower section: scrollable tabs plus a related-markets list. */
export function MobileTradeTabs({
  openPositions,
  holdings,
  quotes,
  related,
}: {
  openPositions: PositionRow[];
  holdings: PositionRow[];
  quotes: Record<string, Quote>;
  related: Instrument[];
}) {
  const [tab, setTab] = useState<Tab>("orders");

  const tabs: { id: Tab; label: string }[] = [
    { id: "orders", label: `Open Orders (${openPositions.length})` },
    { id: "holdings", label: "Holdings" },
    { id: "bots", label: "Bots" },
  ];

  return (
    <section className="mt-4">
      <div className="-mx-1 flex gap-4 overflow-x-auto border-b border-border px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`shrink-0 touch-manipulation border-b-2 pb-2 text-xs font-medium transition-colors ${
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="panel mt-3 overflow-x-auto">
        {tab === "bots" ? (
          <p className="p-4 text-xs text-muted-foreground">
            Trading bots are not enabled on your account yet.
          </p>
        ) : (
          <PositionsTable
            positions={tab === "orders" ? openPositions : holdings}
            quotes={quotes}
            emptyLabel={tab === "orders" ? "No open orders." : "No holdings yet."}
          />
        )}
      </div>

      <h3 className="mb-2 mt-6 text-xs uppercase tracking-widest text-muted-foreground">
        You may be interested in
      </h3>
      <ul className="panel divide-y divide-border">
        {related.map((i) => {
          const q = quotes[i.symbol];
          const up = (q?.changePercent ?? 0) >= 0;
          return (
            <li key={i.symbol}>
              <Link
                to="/terminal/$symbol"
                params={{ symbol: i.symbol }}
                className="flex touch-manipulation items-center gap-3 px-3 py-2.5"
              >
                <AssetIcon symbol={i.symbol} size={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{displaySymbol(i.symbol)}</div>
                  <div className="num text-[10px] text-muted-foreground">
                    Vol {volume(q?.volume)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num text-xs">
                    {q ? formatPrice(q.price, i.symbol) : "—"}
                  </div>
                </div>
                <span
                  className={`num shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    up ? "bg-bull/15 text-bull" : "bg-bear/15 text-bear"
                  }`}
                >
                  {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
