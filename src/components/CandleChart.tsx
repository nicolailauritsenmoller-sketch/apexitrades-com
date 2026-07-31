import { useEffect, useMemo, useRef, useState } from "react";
import type { Candle } from "@/lib/market-types";
import { formatPrice } from "@/lib/instruments";

type Hover = { index: number; x: number; y: number } | null;

/**
 * Lightweight interactive candlestick chart (pure SVG, no chart lib) with
 * crosshair, OHLC tooltip and a live last-price marker.
 */
export function CandleChart({
  candles,
  symbol,
  height = 380,
}: {
  candles: Candle[];
  symbol: string;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [hover, setHover] = useState<Hover>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const padRight = 74;
  const padBottom = 22;
  const padTop = 10;
  const plotW = Math.max(50, width - padRight);
  const plotH = Math.max(60, height - padBottom - padTop);

  const view = useMemo(() => {
    if (candles.length === 0) return null;
    const max = Math.max(...candles.map((c) => c.h));
    const min = Math.min(...candles.map((c) => c.l));
    const pad = (max - min) * 0.08 || max * 0.01 || 1;
    const hi = max + pad;
    const lo = min - pad;
    const y = (v: number) => padTop + ((hi - v) / (hi - lo)) * plotH;
    const slot = plotW / candles.length;
    const x = (i: number) => i * slot + slot / 2;
    const bodyW = Math.max(1.5, Math.min(14, slot * 0.62));
    const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);
    return { hi, lo, y, x, slot, bodyW, ticks };
  }, [candles, plotW, plotH]);

  if (candles.length === 0 || !view) {
    return (
      <div
        ref={wrapRef}
        style={{ height }}
        className="grid place-items-center text-sm text-muted-foreground"
      >
        No chart data available for this instrument right now.
      </div>
    );
  }

  const last = candles[candles.length - 1];
  const lastUp = last.c >= last.o;
  const hovered = hover ? candles[hover.index] : null;

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px > plotW) return setHover(null);
    const index = Math.min(candles.length - 1, Math.max(0, Math.floor(px / view!.slot)));
    setHover({ index, x: view!.x(index), y: e.clientY - rect.top });
  }

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height }}>
      <svg
        width={width}
        height={height}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        className="touch-none select-none"
      >
        {view.ticks.map((t) => (
          <g key={t}>
            <line
              x1={0}
              x2={plotW}
              y1={view.y(t)}
              y2={view.y(t)}
              stroke="var(--color-border)"
              strokeDasharray="2 4"
              opacity={0.6}
            />
            <text
              x={plotW + 6}
              y={view.y(t) + 3}
              fontSize={10}
              fontFamily="var(--font-mono)"
              fill="var(--color-muted-foreground)"
            >
              {formatPrice(t, symbol)}
            </text>
          </g>
        ))}

        {candles.map((c, i) => {
          const up = c.c >= c.o;
          const color = up ? "var(--color-bull)" : "var(--color-bear)";
          const x = view.x(i);
          const yO = view.y(c.o);
          const yC = view.y(c.c);
          const top = Math.min(yO, yC);
          const h = Math.max(1, Math.abs(yC - yO));
          return (
            <g key={c.t}>
              <line x1={x} x2={x} y1={view.y(c.h)} y2={view.y(c.l)} stroke={color} strokeWidth={1} />
              <rect
                x={x - view.bodyW / 2}
                y={top}
                width={view.bodyW}
                height={h}
                fill={color}
                opacity={0.95}
              />
            </g>
          );
        })}

        {/* live last price */}
        <line
          x1={0}
          x2={plotW}
          y1={view.y(last.c)}
          y2={view.y(last.c)}
          stroke={lastUp ? "var(--color-bull)" : "var(--color-bear)"}
          strokeDasharray="4 3"
          strokeWidth={1}
        />
        <rect
          x={plotW + 2}
          y={view.y(last.c) - 8}
          width={padRight - 6}
          height={16}
          rx={3}
          fill={lastUp ? "var(--color-bull)" : "var(--color-bear)"}
        />
        <text
          x={plotW + 6}
          y={view.y(last.c) + 4}
          fontSize={10}
          fontFamily="var(--font-mono)"
          fill="var(--color-background)"
        >
          {formatPrice(last.c, symbol)}
        </text>

        {/* time axis */}
        {[0, Math.floor(candles.length / 2), candles.length - 1].map((i) => (
          <text
            key={i}
            x={Math.min(plotW - 30, Math.max(2, view.x(i) - 18))}
            y={height - 6}
            fontSize={10}
            fontFamily="var(--font-mono)"
            fill="var(--color-muted-foreground)"
          >
            {new Date(candles[i].t).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </text>
        ))}

        {hover && (
          <line
            x1={hover.x}
            x2={hover.x}
            y1={padTop}
            y2={padTop + plotH}
            stroke="var(--color-muted-foreground)"
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hovered && hover && (
        <div
          className="num pointer-events-none absolute top-2 rounded-md border border-border bg-popover px-2.5 py-1.5 text-[11px] shadow-lg"
          style={{ left: Math.min(Math.max(0, hover.x - 70), Math.max(0, plotW - 150)) }}
        >
          <div className="mb-1 text-muted-foreground">
            {new Date(hovered.t).toLocaleString()}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">O</span>
            <span>{formatPrice(hovered.o, symbol)}</span>
            <span className="text-muted-foreground">H</span>
            <span>{formatPrice(hovered.h, symbol)}</span>
            <span className="text-muted-foreground">L</span>
            <span>{formatPrice(hovered.l, symbol)}</span>
            <span className="text-muted-foreground">C</span>
            <span className={hovered.c >= hovered.o ? "text-bull" : "text-bear"}>
              {formatPrice(hovered.c, symbol)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
