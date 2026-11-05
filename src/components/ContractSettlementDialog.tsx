import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { History, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CandleChart } from "@/components/CandleChart";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney, formatPrice } from "@/lib/instruments";
import type { HistoryEntry } from "@/lib/trade-history";
import { getSettlementCandles } from "@/lib/settlement-chart.functions";

export function ContractSettlementDialog({ entry, hidden, onClose, onViewHistory }: {
  entry: HistoryEntry; hidden: boolean; onClose: () => void; onViewHistory: () => void;
}) {
  const fetchCandles = useServerFn(getSettlementCandles);
  const chart = useQuery({ queryKey: ["settlement-candles", entry.id], queryFn: () => fetchCandles({ data: { id: entry.id } }), staleTime: Infinity, retry: false });
  const signed = (value: number) => `${value > 0 ? "+" : ""}${formatMoney(value, entry.currency)}`;
  const money = (value: number | null) => hidden ? "••••" : value == null ? "Not recorded" : formatMoney(value, entry.currency);
  const pnl = hidden ? "••••" : entry.pnl == null ? "Not recorded" : signed(entry.pnl);
  const roi = hidden ? "••••" : entry.pnlPct == null ? "Not recorded" : `${entry.pnlPct > 0 ? "+" : ""}${entry.pnlPct.toFixed(2)}%`;
  const tone = entry.pnl == null || entry.pnl === 0 ? "text-muted-foreground" : entry.pnl > 0 ? "text-bull" : "text-bear";
  const share = async () => {
    if (hidden || entry.pnl == null) return;
    const text = `${entry.displaySymbol} · ${entry.isLong ? "Long" : "Short"} ${entry.leverage}x · Net Realized PnL ${pnl} · ROI ${roi}`;
    try {
      if (navigator.share) { await navigator.share({ title: "Velocity Trade settlement", text }); return; }
      await navigator.clipboard.writeText(text);
      toast.success("PnL copied");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Sharing unavailable. Please try again.");
    }
  };
  const rows = [
    ["Trading Pair", entry.displaySymbol], ["Side", `${entry.isLong ? "Long" : "Short"} ${entry.leverage}x`],
    ["Entry vs. Exit Price", hidden ? "••••" : `${formatPrice(entry.entryPrice, entry.symbol)} → ${formatPrice(entry.exitPrice, entry.symbol)}`],
    ["Settled Amount", money(entry.settledAmount)], ["Total Fees", money(entry.fees)], ["Close Reason", "Auto Settlement / Expired"],
  ];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent onCloseAutoFocus={(event) => { event.preventDefault(); }} className="flex max-h-[92dvh] w-[calc(100%-24px)] max-w-xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
        <AssetIcon symbol={entry.symbol} size={36} />
        <div className="min-w-0"><DialogTitle className="text-base">{entry.displaySymbol} · Closed</DialogTitle>
          <DialogDescription className="num mt-1 text-[10px]">{entry.reference} · Settled contract</DialogDescription></div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <section aria-label="Net realized profit and loss">
          <p className="text-xs text-muted-foreground">Net Realized PnL</p>
          <p className={`num mt-1 break-words text-3xl font-bold sm:text-4xl ${tone}`}>{pnl}</p>
          <p className={`num mt-2 text-sm font-semibold ${tone}`}>ROI {roi}</p>
          <div className="mt-4 border-y border-border py-2" aria-label="Settlement price chart">
            {hidden ? <div className="grid h-[170px] place-items-center text-xs text-muted-foreground">Chart hidden</div>
              : chart.isPending ? <div className="grid h-[170px] place-items-center text-xs text-muted-foreground" role="status">Loading historical candles...</div>
                : chart.data?.candles.length ? <CandleChart candles={chart.data.candles} symbol={entry.symbol} height={170} />
                  : <div className="grid h-[170px] place-items-center text-center text-xs text-muted-foreground">Historical candles unavailable for this settlement.</div>}
            {!hidden && chart.data?.source && <p className="mt-1 text-[10px] text-muted-foreground">{chart.data.source} · Market context, not execution fills</p>}
          </div>
        </section>
        <section className="mt-5" aria-label="Settlement breakdown">
          <h3 className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Settlement breakdown</h3>
          <dl className="divide-y divide-border">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-3 py-3 text-xs sm:text-sm"><dt className="text-muted-foreground">{label}</dt><dd className="num break-words text-right font-medium">{value}</dd></div>)}</dl>
        </section>
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-border bg-background px-5 py-4 sm:grid-cols-3">
        <Button asChild className="col-span-2 min-h-11 font-semibold sm:col-span-1"><Link to="/terminal/$symbol" params={{ symbol: entry.symbol }} onClick={onClose}><RefreshCw />Trade Again</Link></Button>
        <Button variant="outline" className="min-h-11" disabled={hidden || entry.pnl == null} onClick={() => void share()}><Share2 />Share PnL</Button>
        <Button variant="outline" className="min-h-11" onClick={onViewHistory}><History />View History</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}