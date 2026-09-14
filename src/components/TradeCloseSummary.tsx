import { Share2, History, RefreshCw, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney, formatPrice } from "@/lib/instruments";
import type { TradeSummary } from "@/lib/trade-summary";
import { Button } from "@/components/ui/button";
import { TradeSnapshotChart } from "@/components/TradeSnapshotChart";

function settlementReason(reason: string) {
  return reason.toLowerCase().includes("expir") ? "Auto Settlement / Expired" : reason;
}

export function TradeCloseSummary({
  summary,
  onClose,
  onTradeAgain,
}: {
  summary: TradeSummary;
  onClose: () => void;
  onTradeAgain?: () => void;
  onReverse?: () => void;
  onFavorite?: () => void;
}) {
  const navigate = useNavigate();
  const positive = summary.netPnl >= 0;
  const pnlText = `${positive ? "+" : "-"}${formatMoney(Math.abs(summary.netPnl), summary.currency)}`;

  const sharePnl = async () => {
    const text = `${summary.pair} ${summary.side} · ${pnlText} (${summary.profitPct >= 0 ? "+" : ""}${summary.profitPct.toFixed(2)}% ROI)`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Trade result", text });
        return;
      } catch {
        // The clipboard fallback also covers a dismissed native share sheet.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("PnL copied");
    } catch {
      toast.error("Sharing is unavailable");
    }
  };

  const tradeAgain = () => {
    if (onTradeAgain) onTradeAgain();
    else {
      onClose();
      navigate({ to: "/terminal/$symbol", params: { symbol: summary.symbol } });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trade closed summary"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-[94vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-xl sm:rounded-2xl"
      >
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <AssetIcon symbol={summary.symbol} size={36} />
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold">Trade closed</h2>
              <p className="truncate text-xs text-muted-foreground">{summary.pair} · {summary.status}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close summary" className="rounded-full text-muted-foreground">
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <section aria-label="Net realized profit and loss">
            <p className="text-xs font-medium text-muted-foreground">Net Realized PnL</p>
            <p className={`num mt-1 text-4xl font-bold ${positive ? "text-bull" : "text-bear"}`}>{pnlText}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className={`num font-semibold ${positive ? "text-bull" : "text-bear"}`}>
                ROI {summary.profitPct >= 0 ? "+" : ""}{summary.profitPct.toFixed(2)}%
              </span>
              <span className="num">
                {formatPrice(summary.entryPrice, summary.symbol)} → {formatPrice(summary.exitPrice, summary.symbol)}
              </span>
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface px-2 py-1">
              <TradeSnapshotChart summary={summary} />
            </div>
          </section>

          <section className="mt-5" aria-labelledby="settlement-breakdown">
            <h3 id="settlement-breakdown" className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Settlement breakdown
            </h3>
            <dl className="divide-y divide-border rounded-lg border border-border bg-surface px-4">
              <BreakdownRow label="Trading Pair" value={summary.pair} />
              <BreakdownRow label="Side" value={`${summary.side} (${summary.leverage}x)`} />
              <BreakdownRow label="Entry Price vs. Exit Price" value={`${formatPrice(summary.entryPrice, summary.symbol)} → ${formatPrice(summary.exitPrice, summary.symbol)}`} />
              <BreakdownRow label="Settled Amount" value={formatMoney(summary.settledAmount, summary.currency)} />
              <BreakdownRow label="Total Fees" value={formatMoney(summary.totalFees, summary.currency)} />
              <BreakdownRow label="Close Reason" value={settlementReason(summary.closeReason)} />
            </dl>
          </section>
        </div>

        <footer className="grid grid-cols-2 gap-2 border-t border-border bg-background px-5 py-4 sm:grid-cols-3">
          <Button onClick={tradeAgain} className="col-span-2 min-h-11 font-semibold sm:col-span-1">
            <RefreshCw /> Trade Again
          </Button>
          <Button variant="outline" onClick={() => void sharePnl()} className="min-h-11">
            <Share2 /> Share PnL
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              onClose();
              navigate({ to: "/history/orders/$orderId", params: { orderId: summary.orderId } });
            }}
          >
            <History /> View History
          </Button>
        </footer>
      </div>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 text-sm">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="num text-right font-medium">{value}</dd>
    </div>
  );
}