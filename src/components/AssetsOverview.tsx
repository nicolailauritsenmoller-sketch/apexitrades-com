import { AssetIcon } from "@/lib/asset-icons";
import { assetName } from "@/lib/transactions";

export type AssetHolding = {
  currency: string;
  balance: number;
  rate: number;
  valueUsdt: number;
};

function fmt(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Per-asset breakdown: logo, name, quantity, live unit price and USDT value. */
export function AssetsOverview({
  holdings,
  totalUsdt,
  isLoading,
  hideEmpty = true,
}: {
  holdings: AssetHolding[];
  totalUsdt: number;
  isLoading?: boolean;
  hideEmpty?: boolean;
}) {
  const rows = (hideEmpty ? holdings.filter((h) => h.balance > 0) : holdings).sort(
    (a, b) => b.valueUsdt - a.valueUsdt,
  );

  return (
    <section className="panel overflow-hidden">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">Assets overview</h2>
          <p className="text-[11px] text-muted-foreground">
            Every asset you hold, valued at live market rates.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Total portfolio balance
          </p>
          <p className="num text-xl font-bold">{isLoading ? "—" : `${fmt(totalUsdt)} USDT`}</p>
        </div>
      </header>

      {/* Desktop table */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Asset</th>
              <th className="px-4 py-2 text-right font-medium">Quantity</th>
              <th className="px-4 py-2 text-right font-medium">Price (USDT)</th>
              <th className="px-4 py-2 text-right font-medium">Value (USDT)</th>
              <th className="px-4 py-2 text-right font-medium">Allocation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
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
                <td className="num px-4 py-3 text-right">{fmt(h.balance, h.currency === "BTC" ? 6 : 2)}</td>
                <td className="num px-4 py-3 text-right text-muted-foreground">
                  {h.rate ? fmt(h.rate, h.rate < 10 ? 4 : 2) : "—"}
                </td>
                <td className="num px-4 py-3 text-right font-semibold">{fmt(h.valueUsdt)}</td>
                <td className="num px-4 py-3 text-right text-muted-foreground">
                  {totalUsdt > 0 ? `${((h.valueUsdt / totalUsdt) * 100).toFixed(1)}%` : "0.0%"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="divide-y divide-border/60 sm:hidden">
        {rows.map((h) => (
          <div key={h.currency} className="flex items-center gap-3 px-4 py-3">
            <AssetIcon currency={h.currency} size={32} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{assetName(h.currency)}</div>
              <div className="num text-[11px] text-muted-foreground">
                {fmt(h.balance, h.currency === "BTC" ? 6 : 2)} {h.currency}
                {h.rate ? ` · ${fmt(h.rate, h.rate < 10 ? 4 : 2)} USDT` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="num text-sm font-semibold">{fmt(h.valueUsdt)}</div>
              <div className="text-[11px] text-muted-foreground">
                {totalUsdt > 0 ? `${((h.valueUsdt / totalUsdt) * 100).toFixed(1)}%` : "0.0%"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && rows.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          No funded assets yet. Make a deposit to get started.
        </p>
      )}
    </section>
  );
}
