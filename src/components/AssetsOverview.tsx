import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChevronDown, Search, Wallet } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { assetName } from "@/lib/transactions";



export type AssetHolding = {
  currency: string;
  balance: number;
  available?: number;
  frozenMargin?: number;
  inOrders?: number;
  rate: number;
  valueUsdt: number;
};

function fmt(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function qty(value: number, currency: string) {
  return fmt(value, currency === "BTC" || currency === "ETH" ? 6 : 2);
}

function usd(value: number) {
  return `$${fmt(value)}`;
}

type CategoryTab = "all" | "crypto" | "stocks" | "commodities" | "fiat";

const TABS: { key: CategoryTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "crypto", label: "Crypto" },
  { key: "stocks", label: "Stocks/ETFs" },
  { key: "commodities", label: "Commodities" },
  { key: "fiat", label: "Fiat" },
];

const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "CNY", "HKD", "SGD",
  "SEK", "NOK", "DKK", "MXN", "ZAR", "TRY", "INR", "BRL", "KRW",
]);
const COMMODITIES = new Set(["XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER", "WTI", "BRENT"]);
const EQUITY_LIKE = /^[A-Z]{1,5}$/;

/** Classify a wallet currency into one of the filter tab buckets. */
function tabOf(currency: string): Exclude<CategoryTab, "all"> {
  const c = currency.toUpperCase();
  if (FIAT.has(c)) return "fiat";
  if (COMMODITIES.has(c) || c.startsWith("XAU") || c.startsWith("XAG")) return "commodities";
  // Known equity tickers held as tokenized stock/ETF positions.
  if (["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "SPY", "QQQ", "GOOGL", "META"].includes(c))
    return "stocks";
  return "crypto";
}

/**
 * Institutional single-line asset list: icon + name/ticker on the left,
 * quantity + USD value on the right. Tapping a row expands a breakdown
 * drawer with available / in-orders / margin splits and quick actions.
 */
export function AssetsOverview({
  holdings,
  totalUsdt,
  isLoading,
  hideEmpty = true,
  hidden = false,
}: {
  holdings: AssetHolding[];
  totalUsdt: number;
  isLoading?: boolean;
  hideEmpty?: boolean;
  hidden?: boolean;
}) {
  const [hideZero, setHideZero] = useState(hideEmpty);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<CategoryTab>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const mv = (value: string) => (hidden ? "••••••" : value);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return holdings
      .filter((h) => (hideZero ? h.balance > 0 : true))
      .filter((h) => tab === "all" || tabOf(h.currency) === tab)
      .filter(
        (h) =>
          !term ||
          h.currency.toLowerCase().includes(term) ||
          assetName(h.currency).toLowerCase().includes(term),
      )
      .sort((a, b) => b.valueUsdt - a.valueUsdt);
  }, [holdings, hideZero, search, tab]);

  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Assets overview</h2>
        <p className="text-[11px] text-muted-foreground">
          Every asset you hold, valued at live market rates.
        </p>
      </header>

      {/* Category filter tabs */}
      <div
        role="tablist"
        aria-label="Asset categories"
        className="flex gap-1 overflow-x-auto border-b border-border/60 px-4 py-2.5"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`touch-manipulation whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or name"
            aria-label="Search assets"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hideZero}
          onClick={() => setHideZero((v) => !v)}
          className="flex touch-manipulation items-center gap-2 text-xs text-zinc-400"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              hideZero ? "bg-primary" : "bg-zinc-800"
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-all ${
                hideZero ? "left-[1.125rem]" : "left-0.5"
              }`}
            />
          </span>
          <span className="hidden sm:inline">Hide zero balances</span>
          <span className="sm:hidden">Hide 0</span>
        </button>
      </div>

      {/* Single-line rows with expandable breakdown */}
      <div className="divide-y divide-border/60">
        {rows.map((h) => {
          const open = expanded === h.currency;
          const inOrders = h.inOrders ?? 0;
          const margin = h.frozenMargin ?? 0;
          return (
            <div key={h.currency}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded(open ? null : h.currency)}
                className="flex w-full touch-manipulation items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
              >
                <AssetIcon currency={h.currency} size={32} />
                <div className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="truncate text-sm font-semibold">{assetName(h.currency)}</span>
                  <span className="text-[11px] text-muted-foreground">{h.currency}</span>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold">{mv(qty(h.balance, h.currency))}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    {mv(usd(h.valueUsdt))}
                  </div>
                </div>
                <ChevronDown
                  className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    open ? "rotate-180" : ""
                  }`}
                />
              </button>

              {open && (
                <div className="border-t border-border/40 bg-secondary/20 px-4 py-3">
                  <dl className="grid grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <dt className="text-muted-foreground">Available</dt>
                      <dd className="num mt-0.5 font-semibold">
                        {mv(qty(h.available ?? h.balance, h.currency))} {h.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">In Open Orders</dt>
                      <dd className="num mt-0.5 font-semibold">
                        {mv(qty(inOrders, h.currency))} {h.currency}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">In Margin</dt>
                      <dd className="num mt-0.5 font-semibold">
                        {mv(qty(margin, h.currency))} {h.currency}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to="/wallet"
                      search={{ tab: "deposit" }}
                      className="inline-flex touch-manipulation items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      <ArrowDownToLine className="size-3.5" /> Deposit
                    </Link>
                    <Link
                      to="/wallet"
                      search={{ tab: "withdraw" }}
                      className="inline-flex touch-manipulation items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                    >
                      <ArrowUpFromLine className="size-3.5" /> Withdraw
                    </Link>
                    <Link
                      to="/trade"
                      search={{ symbol: `${h.currency}USDT` }}
                      className="inline-flex touch-manipulation items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-semibold"
                    >
                      <Trade className="size-3.5" /> Trade
                    </Link>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!isLoading && rows.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
            <Wallet className="size-6 text-muted-foreground" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">
            No assets to display. Deposit or trade to build your portfolio.
          </p>
        </div>
      )}
    </section>
  );
}
