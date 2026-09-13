import { useMemo, useState } from "react";
import { Search, Wallet } from "lucide-react";
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

/**
 * Per-asset breakdown: logo, name, total / available / in-orders+margin
 * amounts and the live USD valuation, with search and zero-balance filtering.
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
  const mv = (value: string) => (hidden ? "••••••" : value);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return holdings
      .filter((h) => (hideZero ? h.balance > 0 : true))
      .filter(
        (h) =>
          !term ||
          h.currency.toLowerCase().includes(term) ||
          assetName(h.currency).toLowerCase().includes(term),
      )
      .sort((a, b) => b.valueUsdt - a.valueUsdt);
  }, [holdings, hideZero, search]);

  return (
    <section className="panel overflow-hidden">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Assets overview</h2>
        <p className="text-[11px] text-muted-foreground">
          Every asset you hold, valued at live market rates.
        </p>
      </header>

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

      {/* Desktop table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Asset</th>
              <th className="px-4 py-2.5 text-right font-medium">Total Balance</th>
              <th className="px-4 py-2.5 text-right font-medium">Available</th>
              <th className="px-4 py-2.5 text-right font-medium">In Orders / Margin</th>
              <th className="px-4 py-2.5 text-right font-medium">Est. Value (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => {
              const locked = (h.frozenMargin ?? 0) + (h.inOrders ?? 0);
              return (
                <tr key={h.currency} className="border-t border-border/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <AssetIcon currency={h.currency} size={28} />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{assetName(h.currency)}</div>
                        <div className="text-[11px] text-muted-foreground">{h.currency}</div>
                      </div>
                    </div>
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold">
                    {mv(qty(h.balance, h.currency))}
                  </td>
                  <td className="num px-4 py-3 text-right">
                    {mv(qty(h.available ?? h.balance, h.currency))}
                  </td>
                  <td className="num px-4 py-3 text-right text-muted-foreground">
                    {mv(qty(locked, h.currency))}
                  </td>
                  <td className="num px-4 py-3 text-right font-semibold">{mv(usd(h.valueUsdt))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border/60 sm:hidden">
        {rows.map((h) => {
          const locked = (h.frozenMargin ?? 0) + (h.inOrders ?? 0);
          return (
            <div key={h.currency} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <AssetIcon currency={h.currency} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{assetName(h.currency)}</div>
                  <div className="text-[11px] text-muted-foreground">{h.currency}</div>
                </div>
                <div className="text-right">
                  <div className="num text-sm font-semibold">{mv(qty(h.balance, h.currency))}</div>
                  <div className="num text-[11px] text-muted-foreground">
                    {mv(usd(h.valueUsdt))}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <div className="text-muted-foreground">Available</div>
                  <div className="num font-semibold">{mv(qty(h.available ?? h.balance, h.currency))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">In Orders</div>
                  <div className="num font-semibold">{mv(qty(h.inOrders ?? 0, h.currency))}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Margin</div>
                  <div className="num font-semibold">{mv(qty(h.frozenMargin ?? 0, h.currency))}</div>
                </div>
              </div>
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
