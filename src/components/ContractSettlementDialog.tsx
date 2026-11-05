import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { History, RefreshCw, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { getSettlementCandles } from "@/lib/market.functions";
import type { Candle } from "@/lib/market-types";
import type { HistoryEntry } from "@/lib/trade-history";

export function ContractSettlementDialog({ entry: e, hidden = false, onClose, onViewHistory }: {
  entry: HistoryEntry; hidden?: boolean; onClose: () => void; onViewHistory: () => void;
}) {
  const fetchCandles = useServerFn(getSettlementCandles);
  const start = Math.floor(Date.parse(e.openedAt) / 1000);
  const end = Math.floor(Date.parse(e.closedAt) / 1000);
  const chart = useQuery({ queryKey: ["settlement-candles", e.id, start, end], queryFn: () => fetchCandles({ data: { symbol: e.symbol, start, end } }), retry: false, staleTime: Infinity, enabled: !hidden });
  const money = (n: number | null) => hidden ? "••••" : n == null ? "Not recorded" : formatMoney(n, e.currency);
  const pnl = hidden ? "••••" : e.pnl == null ? "Not recorded" : `${e.pnl > 0 ? "+" : ""}${formatMoney(e.pnl, e.currency)}`;
  const roi = hidden ? "••••" : e.pnlPct == null ? "Not recorded" : `${e.pnlPct > 0 ? "+" : ""}${e.pnlPct.toFixed(2)}%`;
  const tone = e.pnl == null || e.pnl === 0 ? "text-muted-foreground" : e.pnl > 0 ? "text-bull" : "text-bear";
  const share = async () => {
    const text = `${e.displaySymbol} · Closed\n${e.isLong ? "Long" : "Short"} ${e.leverage}x\nNet Realized PnL ${pnl}\nROI ${roi}\nVelocity Trade`;
    if (navigator.share) {
      try { await navigator.share({ title: "Velocity Trade settlement", text }); return; }
      catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(text); toast.success("PnL copied"); }
    catch { toast.error("Sharing is unavailable"); }
  };
  const rows = [
    ["Trading Pair", e.displaySymbol], ["Side", `${e.isLong ? "Long" : "Short"} ${e.leverage}x`],
    ["Entry vs. Exit Price", hidden ? "••••" : `${formatPrice(e.entryPrice, e.symbol)} → ${formatPrice(e.exitPrice, e.symbol)}`],
    ["Settled Amount", money(e.settledAmount)], ["Total Fees", money(e.fees)], ["Close Reason", "Auto Settlement / Expired"],
  ];
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[94dvh] w-[calc(100%-24px)] max-w-xl flex-col gap-0 overflow-hidden rounded-lg bg-card p-0">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4 pr-12">
        <AssetIcon symbol={e.symbol} size={36} />
        <div className="min-w-0"><DialogTitle className="text-base leading-6">{e.displaySymbol} · Closed</DialogTitle><DialogDescription className="num mt-1 text-[10px]">{e.reference} · Settlement</DialogDescription></div>
      </header>
      <div className="min-h-0 overflow-y-auto px-5 py-5">
        <p className="text-xs text-muted-foreground">Net Realized PnL</p>
        <p className={`num mt-2 break-words text-3xl font-bold sm:text-4xl ${tone}`}>{pnl}</p>
        <p className={`num mt-2 text-sm font-semibold ${tone}`}>ROI {roi}</p>
        <div className="mt-4 border-y border-border bg-surface py-3" aria-label="Trade duration chart">
          {hidden ? <p className="flex h-36 items-center justify-center text-xs text-muted-foreground">Chart hidden</p>
            : chart.isPending ? <p role="status" className="flex h-36 items-center justify-center text-xs text-muted-foreground">Loading historical candles...</p>
            : chart.data?.length ? <SettlementCandles candles={chart.data} />
            : <p className="flex h-36 items-center justify-center text-xs text-muted-foreground">Historical candles unavailable for this trade.</p>}
          <div className="num mt-2 flex flex-wrap justify-between gap-1 text-[10px] text-muted-foreground"><span>{new Date(e.openedAt).toLocaleString("en-GB", { timeZone: "UTC" })}</span><span>{new Date(e.closedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</span></div>
        </div>
        <h3 className="mb-2 mt-5 text-[10px] font-semibold uppercase text-muted-foreground">Settlement breakdown</h3>
        <dl className="divide-y divide-border">{rows.map(([label, value]) => <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 py-3 text-xs"><dt className="text-muted-foreground">{label}</dt><dd className="num break-words text-right font-medium">{value}</dd></div>)}</dl>
      </div>
      <footer className="grid grid-cols-2 gap-2 border-t border-border px-5 py-4 sm:grid-cols-3">
        <Button asChild className="col-span-2 min-h-11 sm:col-span-1"><Link to="/terminal/$symbol" params={{ symbol: e.symbol }} onClick={onClose}><RefreshCw /> Trade Again</Link></Button>
        <Button variant="outline" onClick={() => void share()} className="min-h-11"><Share2 /> Share PnL</Button>
        <Button variant="outline" onClick={onViewHistory} className="min-h-11"><History /> View History</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}

function SettlementCandles({ candles }: { candles: Candle[] }) {
  const low = Math.min(...candles.map((c) => c.l));
  const high = Math.max(...candles.map((c) => c.h));
  const y = (price: number) => 132 - (price - low) / (high - low || 1) * 120;
  const step = 520 / candles.length;
  return <svg viewBox="0 0 520 144" className="h-36 w-full" role="img" aria-label="Historical candlesticks during the trade">
    {[24, 72, 120].map((y) => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="var(--color-border)" strokeDasharray="3 4" />)}
    {candles.map((c, i) => <g key={c.t} className={c.c >= c.o ? "text-bull" : "text-bear"}><line x1={(i + .5) * step} x2={(i + .5) * step} y1={y(c.h)} y2={y(c.l)} stroke="currentColor" /><rect x={(i + .2) * step} y={y(Math.max(c.o, c.c))} width={Math.max(1, step * .6)} height={Math.max(1, Math.abs(y(c.o) - y(c.c)))} fill="currentColor" /></g>)}
  </svg>;
}