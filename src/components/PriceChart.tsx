import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Candle } from "@/lib/market-types";
import { formatPrice } from "@/lib/instruments";

export function PriceChart({
  candles,
  symbol,
  bullish,
}: {
  candles: Candle[];
  symbol: string;
  bullish: boolean;
}) {
  const data = useMemo(
    () => candles.map((c) => ({ t: c.t, price: c.c, high: c.h, low: c.l })),
    [candles],
  );

  const domain = useMemo(() => {
    if (data.length === 0) return [0, 1] as [number, number];
    const lows = candles.map((c) => c.l);
    const highs = candles.map((c) => c.h);
    const min = Math.min(...lows);
    const max = Math.max(...highs);
    const pad = (max - min) * 0.08 || max * 0.01;
    return [min - pad, max + pad] as [number, number];
  }, [candles, data.length]);

  const stroke = bullish ? "var(--color-bull)" : "var(--color-bear)";

  if (data.length === 0) {
    return (
      <div className="grid h-full min-h-[320px] place-items-center text-sm text-muted-foreground">
        No chart data available for this instrument right now.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
            <stop offset="100%" stopColor={stroke} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="t"
          tickFormatter={(t) =>
            new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
          }
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          minTickGap={48}
        />
        <YAxis
          domain={domain}
          orientation="right"
          width={78}
          stroke="var(--color-muted-foreground)"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatPrice(v, symbol)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-popover)",
            border: "1px solid var(--color-border)",
            borderRadius: "8px",
            fontSize: "12px",
            fontFamily: "var(--font-mono)",
          }}
          labelStyle={{ color: "var(--color-muted-foreground)" }}
          labelFormatter={(t) => new Date(Number(t)).toLocaleString()}
          formatter={(v: number) => [formatPrice(v, symbol), "Price"]}
        />
        <Area
          type="monotone"
          dataKey="price"
          stroke={stroke}
          strokeWidth={1.8}
          fill="url(#priceFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
