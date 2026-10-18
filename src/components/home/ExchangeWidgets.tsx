import { Link } from "@tanstack/react-router";
import { BookOpen, ChevronRight, DollarSign, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreference } from "@/lib/preferences";
import { AssetIcon } from "@/lib/asset-icons";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import { formatPrice } from "@/lib/instruments";
import { sparklinePoints } from "@/lib/home-markets";

export function ExchangeWidgets({ onDeposit }: { onDeposit: () => void }) {
  const [dismissed, setDismissed] = usePreference("dismissedOnboarding", []);
  const { quotes } = useQuotes(["BNBUSDT"], 5000);
  const candles = useCandles("BNBUSDT", "1h");
  const quote = quotes.BNBUSDT;
  const live = quote && !quote.stale;
  const up = (quote?.changePercent ?? 0) >= 0;
  const closes = (candles.data ?? []).slice(-24).map(candle => candle.c);
  if (live && closes.length) closes[closes.length - 1] = quote.price;
  const points = sparklinePoints(closes);

  return <div className="exchange-widgets space-y-4">
    {!dismissed.includes("exchange-market-outlook") && <article className="relative rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Market outlook - The next move</p><Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label="Dismiss market outlook banner" onClick={() => setDismissed([...dismissed, "exchange-market-outlook"])}><X /></Button></div>
      <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><BookOpen className="size-7 text-foreground" /><p className="text-sm font-semibold">Follow the markets. Find your next opportunity.</p><Button asChild variant="secondary" size="sm"><Link to="/markets">Explore</Link></Button></div>
      <div className="mt-4 flex justify-center gap-1" aria-hidden="true"><span className="h-1 w-3 rounded-full bg-foreground" /><span className="size-1 rounded-full bg-muted-foreground/40" /><span className="size-1 rounded-full bg-muted-foreground/40" /></div>
    </article>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <Button variant="ghost" onClick={onDeposit} className="exchange-widget h-auto min-h-44 min-w-0 flex-col items-start justify-between whitespace-normal rounded-lg bg-surface p-4 text-left hover:bg-surface-raised sm:min-h-48">
        <span className="flex items-center gap-2 text-muted-foreground"><span className="grid size-7 place-items-center rounded-full bg-surface-raised text-foreground"><DollarSign /></span><span className="text-xs">USD / USDT</span></span>
        <span className="mt-6 block"><span className="block text-xs font-medium text-bull">Deposit</span><span className="mt-1 block text-base font-semibold">Quick deposit</span><span className="mt-1 block text-[11px] text-muted-foreground">Crypto transfer</span></span>
        <span className="mt-3 flex w-full items-center justify-between text-[10px] text-muted-foreground">Add to your balance <ChevronRight /></span>
      </Button>
      <Link to="/terminal/$symbol" params={{ symbol: "BNBUSDT" }} className="exchange-widget flex min-h-44 min-w-0 flex-col overflow-hidden rounded-lg bg-surface p-4 transition-colors hover:bg-surface-raised sm:min-h-48">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><AssetIcon symbol="BNBUSDT" size={27} />BNB</span>
        <span className="mt-5 text-xl font-semibold tabular-nums">{live ? formatPrice(quote.price, "BNBUSDT") : "-"}</span>
        <span className={`text-xs ${up ? "text-bull" : "text-bear"}`}>{live ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "Price unavailable"}</span>
        <div className={`mt-auto h-16 w-full pt-2 ${up ? "text-bull" : "text-bear"}`}>
          {points ? <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="BNB last 24 hourly prices"><polygon points={`0,80 ${points} 240,80`} fill="currentColor" opacity="0.08" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : <span className="text-[10px] text-muted-foreground">Chart unavailable</span>}
        </div>
      </Link>
    </div>
  </div>;
}