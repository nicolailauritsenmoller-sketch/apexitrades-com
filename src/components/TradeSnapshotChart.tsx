import type { TradeSummary } from "@/lib/trade-summary";

export function TradeSnapshotChart({ summary, className = "h-36" }: { summary: TradeSummary; className?: string }) {
  const { path, entryPrice, exitPrice } = summary;
  const width = 640;
  const height = 180;
  const padding = 12;
  const bucketCount = Math.min(16, Math.max(6, Math.floor(path.length / 3)));
  const bucketSize = Math.max(2, Math.ceil(path.length / bucketCount));
  const candles = Array.from({ length: Math.ceil(path.length / bucketSize) }, (_, index) => {
    const slice = path.slice(index * bucketSize, (index + 1) * bucketSize);
    if (slice.length < 2) return null;
    return { open: slice[0], close: slice.at(-1) ?? slice[0], high: Math.max(...slice), low: Math.min(...slice) };
  }).filter((candle): candle is NonNullable<typeof candle> => candle !== null);
  const min = Math.min(...path, entryPrice, exitPrice);
  const max = Math.max(...path, entryPrice, exitPrice);
  const span = max - min || 1;
  const y = (value: number) => height - padding - ((value - min) / span) * (height - padding * 2);
  const step = width / Math.max(candles.length, 1);
  const bodyWidth = Math.max(3, step * 0.55);
  const resultColor = summary.netPnl >= 0 ? "var(--color-bull)" : "var(--color-bear)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${className} w-full`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Candlestick snapshot from entry to settlement"
    >
      <line x1="0" x2={width} y1={y(entryPrice)} y2={y(entryPrice)} stroke="var(--color-border)" strokeDasharray="4 4" />
      <line x1="0" x2={width} y1={y(exitPrice)} y2={y(exitPrice)} stroke={resultColor} strokeDasharray="2 5" opacity="0.7" />
      {candles.map((candle, index) => {
        const x = index * step + step / 2;
        const color = candle.close >= candle.open ? "var(--color-bull)" : "var(--color-bear)";
        const top = y(Math.max(candle.open, candle.close));
        const bottom = y(Math.min(candle.open, candle.close));
        return (
          <g key={index}>
            <line x1={x} x2={x} y1={y(candle.high)} y2={y(candle.low)} stroke={color} strokeWidth="1.5" />
            <rect x={x - bodyWidth / 2} y={top} width={bodyWidth} height={Math.max(1.5, bottom - top)} fill={color} rx="1" />
          </g>
        );
      })}
      <circle cx={step / 2} cy={y(entryPrice)} r="5" fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth="2" />
      <circle cx={width - step / 2} cy={y(exitPrice)} r="5" fill={resultColor} stroke="var(--color-background)" strokeWidth="2" />
    </svg>
  );
}