import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  X,
  Share2,
  Copy,
  FileDown,
  Table2,
  History,
  Repeat2,
  RefreshCw,
  Star,
  FileText,
  Flag,
} from "lucide-react";
import type { TradeSummary } from "@/lib/trade-summary";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { AssetIcon } from "@/lib/asset-icons";

/** Candlestick snapshot of the exact trade window with entry and exit markers. */
function PnlChart({ summary }: { summary: TradeSummary }) {
  const { path, entryPrice, exitPrice } = summary;
  const w = 640;
  const h = 200;
  const pad = 12;

  const buckets = Math.min(16, Math.max(6, Math.floor(path.length / 3)));
  const perBucket = Math.max(2, Math.ceil(path.length / buckets));
  const candles: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < path.length; i += perBucket) {
    const slice = path.slice(i, i + perBucket);
    if (slice.length < 2) continue;
    candles.push({
      o: slice[0],
      c: slice[slice.length - 1],
      h: Math.max(...slice),
      l: Math.min(...slice),
    });
  }

  const min = Math.min(...path, entryPrice, exitPrice);
  const max = Math.max(...path, entryPrice, exitPrice);
  const span = max - min || 1;
  const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);
  const step = w / candles.length;
  const bw = Math.max(3, step * 0.55);

  const positive = summary.netPnl >= 0;
  const stroke = positive ? "var(--color-bull)" : "var(--color-bear)";
  const exitX = w - step / 2;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-52 w-full"
      preserveAspectRatio="none"
      role="img"
      aria-label="Candlestick chart of the trade window with entry and exit markers"
    >
      <line x1="0" x2={w} y1={y(entryPrice)} y2={y(entryPrice)} stroke="var(--color-border)" strokeDasharray="4 4" />
      <line x1="0" x2={w} y1={y(exitPrice)} y2={y(exitPrice)} stroke={stroke} strokeDasharray="2 5" opacity="0.7" />
      {candles.map((c, i) => {
        const x = i * step + step / 2;
        const up = c.c >= c.o;
        const color = up ? "var(--color-bull)" : "var(--color-bear)";
        const top = y(Math.max(c.o, c.c));
        const bottom = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.5" />
            <rect
              x={x - bw / 2}
              y={top}
              width={bw}
              height={Math.max(1.5, bottom - top)}
              fill={color}
              rx="1"
            />
          </g>
        );
      })}
      <circle cx={step / 2} cy={y(entryPrice)} r="5" fill="var(--color-primary)" stroke="var(--color-background)" strokeWidth="2" />
      <circle cx={exitX} cy={y(exitPrice)} r="5" fill={stroke} stroke="var(--color-background)" strokeWidth="2" />
    </svg>
  );
}


function toCsv(summary: TradeSummary) {
  const rows: string[] = ["Section,Metric,Value"];
  for (const s of summary.sections) {
    for (const [k, v] of s.rows) rows.push(`"${s.title}","${k}","${String(v).replace(/"/g, '""')}"`);
  }
  return rows.join("\n");
}

function toText(summary: TradeSummary) {
  return summary.sections
    .map((s) => `${s.title.toUpperCase()}\n${s.rows.map(([k, v]) => `  ${k}: ${v}`).join("\n")}`)
    .join("\n\n");
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error("Clipboard unavailable");
  }
}

export function TradeCloseSummary({
  summary,
  onClose,
  onTradeAgain,
  onReverse,
  onFavorite,
}: {
  summary: TradeSummary;
  onClose: () => void;
  onTradeAgain?: () => void;
  onReverse?: () => void;
  onFavorite?: () => void;
}) {
  const navigate = useNavigate();
  const [showRaw, setShowRaw] = useState(false);
  const positive = summary.netPnl >= 0;

  const badge = useMemo(() => {
    const map: Record<string, string> = {
      Winning: "bg-bull/12 text-bull border-bull/30",
      Losing: "bg-bear/12 text-bear border-bear/30",
      "Break-even": "bg-muted text-muted-foreground border-border",
      Liquidated: "bg-bear/15 text-bear border-bear/40",
      "Manual Close": "bg-secondary text-secondary-foreground border-border",
    };
    return map[summary.classification] ?? map["Break-even"];
  }, [summary.classification]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Closed trade summary"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <AssetIcon symbol={summary.symbol} size={36} />
            <div>
              <h2 className="text-base font-semibold">{summary.pair} trade closed</h2>
              <p className="text-xs text-muted-foreground">
                {summary.side} · {summary.closeReason} · {summary.tradeId.slice(0, 8)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close summary"
            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {/* Headline */}
          <div className="px-5 pt-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest ${
                  positive ? "bg-bull text-background" : "bg-bear text-background"
                }`}
              >
                {positive ? "Profit" : "Loss"}
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge}`}>
                {summary.classification}
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {summary.status}
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {summary.closeReason}
              </span>
            </div>
            <p
              className={`num mt-3 text-3xl font-bold ${positive ? "text-bull" : "text-bear"}`}
            >
              {positive ? "+" : "-"}
              {formatMoney(Math.abs(summary.netPnl), summary.currency)}
            </p>
            <p className="num text-sm text-muted-foreground">
              {summary.profitPct >= 0 ? "+" : ""}
              {summary.profitPct.toFixed(2)}% · {formatPrice(summary.entryPrice, summary.symbol)} →{" "}
              {formatPrice(summary.exitPrice, summary.symbol)}
            </p>
            <div className="mt-3 rounded-xl border border-border bg-surface p-2">
              <PnlChart summary={summary} />
            </div>
          </div>

          {/* Sections */}
          <div className="grid gap-3 px-5 py-5 sm:grid-cols-2">
            {summary.sections.map((s) => (
              <section key={s.title} className="rounded-xl border border-border bg-surface p-3.5">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {s.title}
                </h3>
                <dl className="space-y-1.5 text-xs">
                  {s.rows.map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="num text-right font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>

          {/* Timeline */}
          <div className="px-5 pb-5">
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Trade timeline
            </h3>
            <ol className="relative space-y-3 border-l border-border pl-5">
              {summary.timeline.map((e, i) => (
                <li key={i} className="relative">
                  <span className="absolute -left-[23px] top-1.5 size-2 rounded-full bg-primary" />
                  <p className="text-xs font-medium">{e.label}</p>
                  <p className="num text-[11px] text-muted-foreground">
                    {e.at}
                    {e.detail ? ` · ${e.detail}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {showRaw && (
            <div className="px-5 pb-5">
              <pre className="num max-h-56 overflow-auto rounded-xl border border-border bg-surface p-3 text-[11px]">
                {JSON.stringify(
                  {
                    tradeId: summary.tradeId,
                    orderId: summary.orderId,
                    positionId: summary.positionId,
                    pair: summary.pair,
                    side: summary.side,
                    entryPrice: summary.entryPrice,
                    exitPrice: summary.exitPrice,
                    grossPnl: summary.grossPnl,
                    netPnl: summary.netPnl,
                    openedAt: summary.openedAt,
                    closedAt: summary.closedAt,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2 border-t border-border bg-background px-5 py-4">
          <div className="flex flex-wrap gap-2">
            <ActionButton
              icon={Share2}
              label="Share trade"
              primary
              onClick={async () => {
                const text = `${summary.pair} ${summary.side} · ${summary.netPnl >= 0 ? "+" : "-"}${formatMoney(Math.abs(summary.netPnl), summary.currency)} (${summary.profitPct.toFixed(2)}%)`;
                if (navigator.share) {
                  try {
                    await navigator.share({ title: "Trade result", text });
                    return;
                  } catch {
                    /* fell through to clipboard */
                  }
                }
                copy(text, "Trade result");
              }}
            />
            <ActionButton icon={Copy} label="Copy summary" onClick={() => copy(toText(summary), "Summary")} />
            <ActionButton
              icon={FileDown}
              label="PDF receipt"
              onClick={() => {
                toast("Opening print dialog — choose “Save as PDF”.");
                window.print();
              }}
            />
            <ActionButton
              icon={Table2}
              label="CSV"
              onClick={() => download(`trade-${summary.tradeId.slice(0, 8)}.csv`, toCsv(summary), "text/csv")}
            />
            <ActionButton icon={Copy} label="Copy trade ID" onClick={() => copy(summary.tradeId, "Trade ID")} />
            <ActionButton
              icon={History}
              label="Open in history"
              onClick={() => {
                onClose();
                navigate({ to: "/dashboard" });
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {onTradeAgain && <ActionButton icon={RefreshCw} label="Trade again" primary onClick={onTradeAgain} />}
            {onReverse && <ActionButton icon={Repeat2} label="Reverse position" onClick={onReverse} />}
            {onFavorite && <ActionButton icon={Star} label="Add to favorites" onClick={onFavorite} />}
            <ActionButton
              icon={FileText}
              label={showRaw ? "Hide order details" : "View order details"}
              onClick={() => setShowRaw((v) => !v)}
            />
            <ActionButton
              icon={History}
              label="Position history"
              onClick={() => {
                onClose();
                navigate({ to: "/dashboard" });
              }}
            />
            <ActionButton
              icon={Flag}
              label="Report an issue"
              onClick={() => {
                onClose();
                window.dispatchEvent(
                  new CustomEvent("velocity:open-chat", {
                    detail: { message: `Issue with trade ${summary.tradeId}` },
                  }),
                );
                toast("Support chat opened.");
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  primary,
}: {
  icon: typeof Copy;
  label: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
