import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type Bucket = "Crypto" | "Stocks" | "Forex" | "Gold & Metals";

const COLOR: Record<Bucket, string> = {
  Crypto: "var(--color-primary)",
  Stocks: "var(--color-chart-purple, #a855f7)",
  Forex: "var(--color-bull)",
  "Gold & Metals": "var(--color-warning, #f0b90b)",
};

const FIAT = new Set(["USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD"]);
const METALS = new Set(["XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER"]);

function bucketOf(currency: string): Bucket {
  const c = currency.toUpperCase();
  if (METALS.has(c)) return "Gold & Metals";
  if (FIAT.has(c)) return "Forex";
  if (/^[A-Z]{1,5}$/.test(c) && c.length <= 5 && /^(AAPL|TSLA|MSFT|NVDA|AMZN|META|GOOG)$/.test(c))
    return "Stocks";
  return "Crypto";
}

/** Donut breakdown of holdings by asset class, mirroring the mobile design. */
export function AssetAllocation({
  holdings,
  total,
  hidden,
}: {
  holdings: { currency: string; valueUsdt: number }[];
  total: number;
  hidden?: boolean;
}) {
  const slices = useMemo(() => {
    const map = new Map<Bucket, number>();
    for (const h of holdings) {
      if (!h.valueUsdt) continue;
      const b = bucketOf(h.currency);
      map.set(b, (map.get(b) ?? 0) + h.valueUsdt);
    }
    const sum = Array.from(map.values()).reduce((a, b) => a + b, 0);
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: sum > 0 ? (value / sum) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Asset Allocation</h2>
        <Link to="/assets" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>

      {slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No funded assets yet. Make a deposit to see your allocation.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="relative h-40 min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  innerRadius="62%"
                  outerRadius="100%"
                  paddingAngle={1}
                  stroke="none"
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={COLOR[s.name as Bucket]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="num text-sm font-bold">
                {hidden
                  ? "••••"
                  : total.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </span>
              <span className="text-[10px] text-muted-foreground">USDT</span>
            </div>
          </div>

          <ul className="space-y-2.5 text-xs">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-3">
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: COLOR[s.name as Bucket] }}
                />
                <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                <span className="num font-semibold">{s.pct.toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
