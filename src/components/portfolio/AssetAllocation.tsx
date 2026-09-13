import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { ASSET_CLASS_LABEL, INSTRUMENTS, type AssetClass } from "@/lib/instruments";

/** Primary market categories, in display order, matching the Markets page. */
const CATEGORY_ORDER: AssetClass[] = [
  "crypto",
  "stock",
  "future",
  "forex",
  "metal",
  "etf",
  "index",
  "energy",
  "agriculture",
  "bond",
  "option",
  "rate",
  "reit",
  "fund",
];

/** High-contrast asset class colors for the donut chart. */
const CATEGORY_COLOR: Record<AssetClass, string> = {
  crypto: "#FCD535",
  stock: "#3B82F6",
  future: "#8B5CF6",
  forex: "#0ECB81",
  metal: "#F0B90B",
  etf: "#14B8A6",
  index: "#EC4899",
  energy: "#F97316",
  agriculture: "#84CC16",
  bond: "#60A5FA",
  option: "#A855F7",
  rate: "#38BDF8",
  reit: "#FB7185",
  fund: "#94A3B8",
};

const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "CNY", "HKD", "SGD",
  "SEK", "NOK", "DKK", "MXN", "ZAR", "TRY", "INR", "BRL", "KRW",
]);
const STABLES = new Set(["USDT", "USDC", "BUSD", "DAI", "FDUSD", "TUSD"]);
const METALS = new Set(["XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER"]);

/** Crypto base codes (BTC, ETH, …) derived from the live catalog. */
const CRYPTO_BASES = new Set(
  INSTRUMENTS.filter((i) => i.assetClass === "crypto").map((i) =>
    i.symbol.replace(/USDT$/, ""),
  ),
);

/** Exact instrument-symbol → asset class lookup (AAPL, SPY, ZN=F, GC=F, …). */
const SYMBOL_CLASS = new Map(INSTRUMENTS.map((i) => [i.symbol.toUpperCase(), i.assetClass]));

/** Classify a wallet currency into one of the primary market categories. */
export function categoryOf(currency: string): AssetClass {
  const c = currency.toUpperCase();
  const direct = SYMBOL_CLASS.get(c);
  if (direct) return direct;
  if (METALS.has(c) || c.startsWith("XAU") || c.startsWith("XAG")) return "metal";
  if (FIAT.has(c) || STABLES.has(c)) return "forex";
  if (CRYPTO_BASES.has(c)) return "crypto";
  return "crypto";
}

type Slice = { cls: AssetClass; name: string; value: number; pct: number };

/** Donut breakdown of holdings by primary market category. */
export function AssetAllocation({
  holdings,
  total,
  hidden,
}: {
  holdings: { currency: string; valueUsdt: number }[];
  total: number;
  hidden?: boolean;
}) {
  const { funded, empty } = useMemo(() => {
    const map = new Map<AssetClass, number>();
    for (const h of holdings) {
      if (!h.valueUsdt) continue;
      const cls = categoryOf(h.currency);
      map.set(cls, (map.get(cls) ?? 0) + h.valueUsdt);
    }
    const denom = total > 0 ? total : Array.from(map.values()).reduce((a, b) => a + b, 0);
    const slices: Slice[] = CATEGORY_ORDER.map((cls) => {
      const value = map.get(cls) ?? 0;
      return {
        cls,
        name: ASSET_CLASS_LABEL[cls],
        value,
        pct: denom > 0 ? (value / denom) * 100 : 0,
      };
    });
    return {
      funded: slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value),
      empty: slices.filter((s) => s.value <= 0),
    };
  }, [holdings, total]);

  const fmtUsd = (n: number) =>
    `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <section className="panel p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Asset Allocation</h2>
        <Link to="/assets" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>

      {funded.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No funded assets yet. Make a deposit to see your allocation.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="relative h-40 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={funded}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="62%"
                    outerRadius="100%"
                    paddingAngle={1}
                    stroke="none"
                  >
                    {funded.map((s) => (
                      <Cell key={s.cls} fill={CATEGORY_COLOR[s.cls]} />
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

            <ul className="min-w-0 space-y-2 text-xs">
              {funded.map((s) => (
                <li key={s.cls} className="flex items-center gap-2.5">
                  <span
                    className="size-2.5 shrink-0 rounded-[3px]"
                    style={{ background: CATEGORY_COLOR[s.cls] }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
                  <span className="num shrink-0 text-muted-foreground">
                    {hidden ? "••••" : fmtUsd(s.value)}
                  </span>
                  <span className="num w-12 shrink-0 text-right font-semibold">
                    {hidden ? "••••" : `${s.pct.toFixed(1)}%`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {empty.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground/70">
              {empty.map((s) => (
                <li key={s.cls} className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-[2px] opacity-40"
                    style={{ background: CATEGORY_COLOR[s.cls] }}
                  />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <span className="num shrink-0">
                    {hidden ? "••••" : "$0.00 · 0.00%"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
