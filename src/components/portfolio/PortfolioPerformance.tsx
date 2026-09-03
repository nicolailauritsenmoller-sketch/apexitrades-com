import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const RANGES = ["1D", "1W", "1M", "3M", "1Y", "ALL"] as const;
export type Range = (typeof RANGES)[number];

const POINTS: Record<Range, { count: number; stepMs: number }> = {
  "1D": { count: 24, stepMs: 3_600_000 },
  "1W": { count: 28, stepMs: 6 * 3_600_000 },
  "1M": { count: 30, stepMs: 86_400_000 },
  "3M": { count: 45, stepMs: 2 * 86_400_000 },
  "1Y": { count: 52, stepMs: 7 * 86_400_000 },
  ALL: { count: 60, stepMs: 14 * 86_400_000 },
};

/** Deterministic pseudo-random in [-1, 1] so the curve is stable between renders. */
function noise(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

/**
 * Portfolio value trend. The series is reconstructed backwards from the live
 * total using the period drift, so the right edge always equals the real balance.
 */
export function PortfolioPerformance({
  total,
  drift,
  range,
  onRangeChange,
  hidden,
}: {
  total: number;
  drift: number;
  range: Range;
  onRangeChange: (r: Range) => void;
  hidden?: boolean;
}) {
  const data = useMemo(() => {
    const { count, stepMs } = POINTS[range];
    const start = Math.max(total - drift, total * 0.55, 0);
    const now = Date.now();
    return Array.from({ length: count }, (_, i) => {
      const t = i / (count - 1);
      const base = start + (total - start) * t;
      const wobble = base * 0.025 * noise(i + 1) * (1 - Math.abs(t - 0.5));
      return {
        time: new Date(now - (count - 1 - i) * stepMs).toISOString(),
        value: i === count - 1 ? total : Math.max(base + wobble, 0),
      };
    });
  }, [total, drift, range]);

  const first = data[0]?.value ?? 0;
  const change = total - first;
  const pct = first > 0 ? (change / first) * 100 : 0;
  const up = change >= 0;

  const label = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <div>
      <div className={`num text-sm font-semibold ${up ? "text-bull" : "text-bear"}`}>
        {hidden
          ? "••••"
          : `${up ? "+" : "-"}$${Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 2 })} (${up ? "+" : ""}${pct.toFixed(2)}%)`}
      </div>

      <div className="mt-3 flex touch-manipulation gap-1 overflow-x-auto rounded-xl bg-secondary/60 p-1">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => onRangeChange(r)}
            aria-pressed={r === range}
            className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              r === range
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="mt-3 h-48 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pfArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey="time"
              tickFormatter={label}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={28}
            />
            <YAxis
              width={52}
              tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => (hidden ? "•••" : v.toLocaleString("en-US", { maximumFractionDigits: 0 }))}
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 12,
                fontSize: 12,
              }}
              labelFormatter={label}
              formatter={(v: number) => [
                hidden ? "••••" : `${v.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`,
                "Value",
              ]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2}
              fill="url(#pfArea)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
