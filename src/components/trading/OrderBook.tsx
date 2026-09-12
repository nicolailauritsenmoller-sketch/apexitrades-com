import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUp, ArrowDown, Rows3 } from "lucide-react";
import { getDepth } from "@/lib/orderbook.functions";
import { INSTRUMENT_MAP } from "@/lib/instruments";
import type { Quote } from "@/lib/market-types";

type Level = { price: number; qty: number };
type Row = Level & { total: number };

type ViewMode = "both" | "asks" | "bids";

const ROWS = 12;

function groupLevels(levels: Level[], step: number, side: "ask" | "bid"): Level[] {
  const map = new Map<number, number>();
  for (const l of levels) {
    const bucket =
      side === "ask" ? Math.ceil(l.price / step) * step : Math.floor(l.price / step) * step;
    const key = +bucket.toFixed(8);
    map.set(key, (map.get(key) ?? 0) + l.qty);
  }
  const out = [...map.entries()].map(([price, qty]) => ({ price, qty }));
  out.sort((a, b) => (side === "ask" ? a.price - b.price : b.price - a.price));
  return out;
}

function cumulative(levels: Level[]): Row[] {
  let total = 0;
  return levels.map((l) => {
    total += l.qty;
    return { ...l, total };
  });
}

function fmt(n: number, digits: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function fmtQty(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return n.toFixed(n >= 100 ? 2 : 4);
}

/** Adds a short-lived flash class whenever a row's size changes. */
function useFlash(rows: Row[], side: "ask" | "bid") {
  const prev = useRef<Map<number, number>>(new Map());
  const [flashed, setFlashed] = useState<Set<number>>(new Set());

  useEffect(() => {
    const next = new Set<number>();
    for (const r of rows) {
      const before = prev.current.get(r.price);
      if (before !== undefined && before !== r.qty) next.add(r.price);
    }
    prev.current = new Map(rows.map((r) => [r.price, r.qty]));
    if (next.size === 0) return;
    setFlashed(next);
    const id = setTimeout(() => setFlashed(new Set()), 420);
    return () => clearTimeout(id);
  }, [rows]);

  return (price: number) => (flashed.has(price) ? `ob-flash-${side}` : "");
}

export function OrderBook({
  symbol,
  quote,
  onSelectPrice,
  compact = false,
}: {
  symbol: string;
  quote?: Quote;
  onSelectPrice?: (price: number) => void;
  /** Binance-style mini book used in the mobile dual-column trade layout. */
  compact?: boolean;
}) {
  const inst = INSTRUMENT_MAP[symbol];
  const basePrecision = inst?.precision ?? 2;
  const steps = useMemo(() => {
    const out: number[] = [];
    for (let d = basePrecision; d >= Math.max(basePrecision - 3, -2); d--) out.push(10 ** -d);
    return out;
  }, [basePrecision]);
  const [step, setStep] = useState(steps[0]);
  const [mode, setMode] = useState<ViewMode>("both");
  const [marginMode, setMarginMode] = useState<"cross" | "isolated">("cross");
  const baseRows = compact ? 5 : ROWS;

  useEffect(() => setStep(steps[0]), [steps]);

  const fetchDepthFn = useServerFn(getDepth);
  const depth = useQuery({
    queryKey: ["depth", symbol],
    queryFn: () => fetchDepthFn({ data: { symbol } }),
    refetchInterval: 2500,
    staleTime: 0,
  });

  const digits = Math.max(0, Math.round(-Math.log10(step)));
  const rowCount = mode === "both" ? baseRows : baseRows * 2;

  const asks = useMemo(
    () => cumulative(groupLevels(depth.data?.asks ?? [], step, "ask").slice(0, rowCount)),
    [depth.data, step, rowCount],
  );
  const bids = useMemo(
    () => cumulative(groupLevels(depth.data?.bids ?? [], step, "bid").slice(0, rowCount)),
    [depth.data, step, rowCount],
  );

  const askFlash = useFlash(asks, "ask");
  const bidFlash = useFlash(bids, "bid");

  const maxTotal = Math.max(asks.at(-1)?.total ?? 0, bids.at(-1)?.total ?? 0, 1);
  const bestAsk = asks[0]?.price;
  const bestBid = bids[0]?.price;
  const mid = bestAsk && bestBid ? (bestAsk + bestBid) / 2 : quote?.price;
  const spread = bestAsk && bestBid ? bestAsk - bestBid : 0;
  const spreadPct = mid ? (spread / mid) * 100 : 0;

  const bidVol = bids.reduce((s, r) => s + r.qty, 0);
  const askVol = asks.reduce((s, r) => s + r.qty, 0);
  const buyPct = bidVol + askVol > 0 ? (bidVol / (bidVol + askVol)) * 100 : 50;

  // Direction of the last market price move drives the banner flash colour.
  const lastPrice = quote?.price;
  const prevPrice = useRef<number | undefined>(undefined);
  const [dir, setDir] = useState<"up" | "down">("up");
  useEffect(() => {
    if (lastPrice == null) return;
    if (prevPrice.current != null && lastPrice !== prevPrice.current) {
      setDir(lastPrice > prevPrice.current ? "up" : "down");
    }
    prevPrice.current = lastPrice;
  }, [lastPrice]);

  const renderRow = (r: Row, side: "ask" | "bid") => (
    <button
      key={`${side}-${r.price}`}
      type="button"
      onClick={() => onSelectPrice?.(r.price)}
      className={`relative grid w-full ${compact ? "grid-cols-2" : "grid-cols-3"} items-center px-2 py-[3px] text-left text-[11px] leading-4 touch-manipulation hover:bg-secondary/60 ${
        side === "ask" ? askFlash(r.price) : bidFlash(r.price)
      }`}
      title="Use this price"
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 right-0 ${side === "ask" ? "bg-bear/15" : "bg-bull/15"}`}
        style={{ width: `${Math.min(100, (r.total / maxTotal) * 100)}%` }}
      />
      <span className={`num relative ${side === "ask" ? "text-bear" : "text-bull"}`}>
        {fmt(r.price, digits)}
      </span>
      <span className="num relative text-right text-foreground">{fmtQty(r.qty)}</span>
      {!compact && (
        <span className="num relative text-right text-muted-foreground">{fmtQty(r.total)}</span>
      )}
    </button>
  );

  return (
    <section className="panel flex min-w-0 max-w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Order book</h2>
        {compact ? (
          <button
            onClick={() => setMarginMode((m) => (m === "cross" ? "isolated" : "cross"))}
            className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
          >
            {marginMode}
          </button>
        ) : (
          <div className="flex gap-1">
            {(["both", "asks", "bids"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                aria-label={m === "both" ? "Asks and bids" : m === "asks" ? "Asks only" : "Bids only"}
                className={`rounded border px-1.5 py-0.5 text-[10px] uppercase transition-colors ${
                  mode === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "both" ? "Both" : m === "asks" ? "Asks" : "Bids"}
              </button>
            ))}
          </div>
        )}
      </header>

      <div
        className={`grid ${compact ? "grid-cols-2" : "grid-cols-3"} px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground`}
      >
        <span>{compact ? `Price (${inst?.currency ?? "USDT"})` : "Price"}</span>
        <span className="text-right">{compact ? "Amount" : "Size"}</span>
        {!compact && <span className="text-right">Total</span>}
      </div>

      {mode !== "bids" && (
        <div className="flex flex-col-reverse">{asks.map((r) => renderRow(r, "ask"))}</div>
      )}

      <div
        key={`${lastPrice}`}
        className={`border-y border-border px-3 py-2 ${
          dir === "up" ? "ob-banner-up" : "ob-banner-down"
        } ${compact ? "text-center" : "flex items-center justify-between"}`}
      >
        <div className={`flex items-center gap-1.5 ${compact ? "justify-center" : ""}`}>
          {dir === "up" ? (
            <ArrowUp className="size-4 text-bull" />
          ) : (
            <ArrowDown className="size-4 text-bear" />
          )}
          <span
            className={`num font-bold ${compact ? "text-base text-foreground" : "text-lg"} ${
              compact ? "" : dir === "up" ? "text-bull" : "text-bear"
            }`}
          >
            {lastPrice != null ? fmt(lastPrice, digits) : "—"}
          </span>
        </div>
        <div
          className={`text-[10px] text-muted-foreground ${compact ? "text-center" : "text-right"}`}
        >
          <div className="num">≈ ${lastPrice != null ? fmt(lastPrice, 2) : "—"}</div>
          {!compact && <div className="num">Spread {spreadPct.toFixed(3)}%</div>}
        </div>
      </div>

      {mode !== "asks" && <div>{bids.map((r) => renderRow(r, "bid"))}</div>}

      <div className="mt-auto border-t border-border px-3 py-2">
        <div className="mb-1 flex justify-between text-[10px]">
          <span className="text-bull">B {buyPct.toFixed(2)}%</span>
          <span className="text-bear">{(100 - buyPct).toFixed(2)}% S</span>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-bear/40">
          <div className="bg-bull" style={{ width: `${buyPct}%` }} />
          <div className="flex-1 bg-bear" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {compact ? (
            <button
              onClick={() => setMode((m) => (m === "both" ? "asks" : m === "asks" ? "bids" : "both"))}
              aria-label="Change order book layout"
              className="rounded border border-border p-1 text-muted-foreground"
            >
              <Rows3 className="size-3.5" />
            </button>
          ) : (
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Precision
            </label>
          )}
          <select
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            aria-label="Order book price precision"
            className="rounded border border-border bg-surface px-2 py-1 text-[11px] outline-none focus:border-ring"
          >
            {steps.map((s) => (
              <option key={s} value={s}>
                {s < 1 ? s.toFixed(Math.round(-Math.log10(s))) : s.toString()}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}
