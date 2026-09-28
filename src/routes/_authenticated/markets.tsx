import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AssetIcon } from "@/lib/asset-icons";
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
      { title: "Markets - Velocity Trade" },
      {
        name: "description",
        content:
          "Browse live prices for crypto pairs, US stocks, index futures, major forex pairs and precious metals in one terminal.",
      },
      { property: "og:title", content: "Markets - Velocity Trade" },
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

const TABS: ("all" | AssetClass)[] = [
  "all",
  "crypto",
  "etf",
  "index",
  "energy",
  "agriculture",
  "bond",
  "option",
  "rate",
  "reit",
  "fund",
  "stock",
  "future",
  "forex",
  "metal",
];


const PAGE_SIZE = 50;
const ROWS_PER_PAGE = 20;

function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

function Markets() {
  const [tab, setTab] = useState<"all" | AssetClass>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [infinite, setInfinite] = useState(true);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const pageCount = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const currentPage = Math.min(page, pageCount);

  const visible = useMemo(
    () =>
      infinite
        ? filtered.slice(0, limit)
        : filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE),
    [filtered, limit, infinite, currentPage],
  );

  const hasMore = infinite && visible.length < filtered.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setLoadingMore(true);
        window.setTimeout(() => {
          setLimit((n) => n + PAGE_SIZE);
          setLoadingMore(false);
        }, 180);
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const { quotes } = useQuotes(
    visible.map((i) => i.symbol),
    8000,
  );

  const summary = useQuotes(["BTCUSDT", "AAPL", "XAUUSD=X"], 8000).quotes;

  return (
    <AppShell>
      <div className="mb-4">
        <h1 className="text-xl font-bold sm:text-2xl">Markets</h1>
        <p className="text-sm text-muted-foreground">
          Live prices across crypto, stocks, futures, forex and metals.
        </p>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimit(50);
          }}
          placeholder="Search instruments"
          className="w-full rounded-xl border border-input bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-ring"
        />
      </div>

      <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setLimit(50);
            }}
            className={`shrink-0 touch-manipulation rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground"
            }`}
          >
            {t === "all" ? "All" : ASSET_CLASS_LABEL[t]}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        {[
          { label: "Crypto", symbol: "BTCUSDT" },
          { label: "Stocks", symbol: "AAPL" },
          { label: "Gold", symbol: "XAUUSD=X" },
        ].map(({ label, symbol }) => {
          const s = summary[symbol];
          const up = (s?.changePercent ?? 0) >= 0;
          return (
            <div key={label} className="panel p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <AssetIcon symbol={symbol} size={16} />
                {label}
              </div>
              <div className="num mt-1 truncate text-sm font-bold">
                {s && !s.stale ? formatPrice(s.price, symbol) : "-"}
              </div>
              <div className={`num text-[11px] font-semibold ${up ? "text-bull" : "text-bear"}`}>
                {s && !s.stale ? `${up ? "+" : ""}${s.changePercent.toFixed(2)}%` : "-"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
          Market overview
        </h2>
        <button
          onClick={() => {
            setInfinite((v) => !v);
            setLimit(PAGE_SIZE);
            setPage(1);
          }}
          className="touch-manipulation text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        >
          {infinite ? "Use pagination" : "Use infinite scroll"}
        </button>
      </div>

      {/* Mobile list */}
      <div className="panel px-4 md:hidden">
        {visible.map((i) => {
          const quote = quotes[i.symbol];
          const up = (quote?.changePercent ?? 0) >= 0;
          return (
            <Link
              key={i.symbol}
              to="/terminal/$symbol"
              params={{ symbol: i.symbol }}
              className="flex touch-manipulation items-center gap-3 border-b border-border/60 py-3 last:border-0"
            >
              <AssetIcon symbol={i.symbol} size={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{displaySymbol(i.symbol)}</div>
                <div className="truncate text-[11px] text-muted-foreground">{i.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num text-sm font-semibold">
                  {quote && !quote.stale ? formatPrice(quote.price, i.symbol) : "-"}
                </div>
                <div className={`num text-[11px] font-semibold ${up ? "text-bull" : "text-bear"}`}>
                  {quote && !quote.stale
                    ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                    : "-"}
                </div>
              </div>
            </Link>
          );
        })}
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No instruments match your search.
          </p>
        )}
      </div>

      <div className="panel hidden overflow-x-auto md:block">
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
            {visible.map((i) => {
              const quote = quotes[i.symbol];
              const up = (quote?.changePercent ?? 0) >= 0;
              return (
                <tr key={i.symbol} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AssetIcon symbol={i.symbol} size={26} />
                      <div className="min-w-0">
                        <div className="font-medium">{displaySymbol(i.symbol)}</div>
                        <div className="text-[11px] text-muted-foreground">{i.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {ASSET_CLASS_LABEL[i.assetClass]}
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {quote && !quote.stale ? formatPrice(quote.price, i.symbol) : "-"}
                  </td>
                  <td
                    className={`num px-4 py-3 text-right ${up ? "text-bull" : "text-bear"}`}
                  >
                    {quote && !quote.stale
                      ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%`
                      : "-"}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {quote && !quote.stale ? formatPrice(quote.high, i.symbol) : "-"}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {quote && !quote.stale ? formatPrice(quote.low, i.symbol) : "-"}
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
        {visible.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No instruments match your search.
          </p>
        )}
      </div>
      {infinite ? (
        <>
          <div ref={sentinelRef} aria-hidden className="h-px w-full" />
          {hasMore && (
            <div className="mt-3 space-y-2" aria-live="polite">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading more instruments…
                </div>
              ) : (
                [0, 1, 2].map((k) => (
                  <div
                    key={k}
                    className="flex items-center gap-3 rounded-xl border border-border/40 px-4 py-3"
                  >
                    <div className="size-7 animate-pulse rounded-full bg-muted" />
                    <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                    <div className="ml-auto h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                ))
              )}
            </div>
          )}
        </>
      ) : (
        filtered.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 text-sm">
            <span className="text-xs text-muted-foreground">
              Rows per page: {ROWS_PER_PAGE}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
              >
                ‹
              </button>
              {pageNumbers(currentPage, pageCount).map((p, idx) =>
                p === "…" ? (
                  <span key={`e${idx}`} className="px-1.5 text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`min-w-7 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                      p === currentPage
                        ? "bg-primary text-primary-foreground"
                        : "border border-border text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {p}
                  </button>
                ),
              )}
              <button
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage === pageCount}
                aria-label="Next page"
                className="rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
              >
                ›
              </button>
            </div>
          </div>
        )
      )}
    </AppShell>
  );
}
