import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import type { Timeframe } from "@/lib/market-types";
import { formatPrice, INSTRUMENT_MAP } from "@/lib/instruments";
import { AssetIcon } from "@/lib/asset-icons";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TradingViewChart } from "@/components/trading/TradingViewChart";

export type MovementChartAlert = { symbol: string; title: string; detail: string; at: string };

function MovementChart({ alert }: { alert: MovementChartAlert }) {
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const candles = useCandles(alert.symbol, timeframe);
  const market = useQuotes([alert.symbol], 5000);
  const quote = market.quotes[alert.symbol];
  const instrument = INSTRUMENT_MAP[alert.symbol];
  const live = quote && !quote.stale;
  return <>
    <DialogHeader className="pr-8 text-left">
      <DialogTitle className="flex items-center gap-3"><AssetIcon symbol={alert.symbol} size={32} /><span>{alert.symbol.replace("USDT", "/USDT")}<span className="mt-1 block text-xs font-normal text-muted-foreground">{instrument?.name ?? alert.symbol}</span></span></DialogTitle>
      <DialogDescription>{alert.title} · {new Date(alert.at).toLocaleString()}</DialogDescription>
    </DialogHeader>
    <div className="flex flex-wrap items-end justify-between gap-3 border-y border-border py-4">
      <div><p className="num text-2xl font-semibold" aria-label="Current asset price">{quote ? formatPrice(quote.price, alert.symbol) : "-"}<span className="ml-2 text-xs font-normal text-muted-foreground">USDT</span></p><p className={`num mt-1 text-sm ${live ? quote.changePercent >= 0 ? "text-bull" : "text-bear" : "text-muted-foreground"}`}>{quote ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "-"}<span className="ml-2 text-xs text-muted-foreground">24h</span></p></div>
      <div className="text-right text-xs text-muted-foreground"><p className={live ? "text-bull" : "text-muted-foreground"}>{live ? "Live price" : "Awaiting live price"}</p>{quote && <p className="num mt-1">24h High {formatPrice(quote.high, alert.symbol)} · Low {formatPrice(quote.low, alert.symbol)}</p>}</div>
    </div>
    <div className="min-w-0 overflow-hidden" aria-label={`${alert.symbol} live price and volume chart`}>
      <TradingViewChart key={alert.symbol} symbol={alert.symbol} candles={(candles.data ?? []).slice(-80)} quote={live ? quote : undefined} timeframe={timeframe} onTimeframeChange={setTimeframe} height={480} isLoading={candles.isPending} movementPreview />
    </div>
    {(candles.isError || (!candles.isPending && !candles.data?.length)) && <div role="status" className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Chart feed interrupted. Reconnecting automatically.</span><Button variant="ghost" size="icon" aria-label="Retry movement chart" title="Retry movement chart" onClick={() => void candles.refetch()}><RefreshCw /></Button></div>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3"><p className="max-w-md text-xs text-muted-foreground">{alert.detail}</p>{instrument && <Button asChild variant="outline" size="sm"><Link to="/terminal/$symbol" params={{ symbol: alert.symbol }}>Open terminal<ArrowUpRight /></Link></Button>}</div>
  </>;
}

export function MovementChartDialog({ alert, onClose }: { alert: MovementChartAlert | null; onClose: () => void }) {
  return <Dialog open={Boolean(alert)} onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[92dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">{alert && <MovementChart key={alert.symbol} alert={alert} />}</DialogContent></Dialog>;
}