import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, ChevronRight, DollarSign, ShieldCheck, TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePreference } from "@/lib/preferences";
import { AssetIcon } from "@/lib/asset-icons";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import { formatPrice } from "@/lib/instruments";
import { sparklinePoints } from "@/lib/home-markets";

export function ExchangeWidgets({ onDeposit }: { onDeposit: () => void }) {
  const [dismissed, setDismissed] = usePreference("dismissedOnboarding", []);
  const [slide, setSlide] = useState(0);
  const [claimOpen, setClaimOpen] = useState(false);
  const { quotes } = useQuotes(["BTCUSDT"], 5000);
  const candles = useCandles("BTCUSDT", "1h");
  const quote = quotes.BTCUSDT;
  const live = quote && !quote.stale;
  const up = (quote?.changePercent ?? 0) >= 0;
  const closes = (candles.data ?? []).slice(-24).map(candle => candle.c);
  if (live && closes.length) closes[closes.length - 1] = quote.price;
  const points = sparklinePoints(closes);

  return <div className="exchange-widgets space-y-3">
    {!dismissed.includes("exchange-futures-promo") && <article className="relative rounded-lg border border-border bg-surface px-3 py-2" aria-label="Exchange promotions">
      <div className="flex items-center justify-between gap-2"><p className="text-[11px] text-muted-foreground">{slide === 0 ? "Futures copy trading - Coming soon" : slide === 1 ? "Market outlook" : "Futures markets"}</p><Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Dismiss promotions" onClick={() => setDismissed([...dismissed, "exchange-futures-promo"])}><X /></Button></div>
      <div className="grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        {slide === 0 ? <ShieldCheck className="size-6 text-warning" /> : slide === 1 ? <BookOpen className="size-6 text-foreground" /> : <TrendingUp className="size-6 text-bull" />}
        <div className="min-w-0"><h2 className="text-[12px] leading-4 font-semibold">{slide === 0 ? "Start Futures Copy Trading" : slide === 1 ? "Follow the markets" : "Explore Futures"}</h2><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{slide === 0 ? "Protect Losses Up to 10 USDT" : slide === 1 ? "Trading commentary & outlooks" : "Live prices and trading charts"}</p></div>
        {slide === 0 ? <Button size="sm" variant="secondary" className="min-h-10 px-3 text-xs" onClick={() => setClaimOpen(true)}>Claim</Button> : <Button asChild variant="secondary" size="sm" className="min-h-10 text-xs"><Link to={slide === 1 ? "/markets" : "/terminal/$symbol"} params={{ symbol: "ES=F" }}>Explore</Link></Button>}
      </div>
      <div className="-my-1 flex justify-center" role="group" aria-label="Promotion pagination">{[0, 1, 2].map(index => <Button key={index} variant="ghost" size="icon" className="size-8" aria-label={`Show promotion ${index + 1}`} aria-pressed={slide === index} onClick={() => setSlide(index)}><span className={`h-1 rounded-full ${slide === index ? "w-3 bg-foreground" : "w-1 bg-muted-foreground/40"}`} /></Button>)}</div>
    </article>}
    <Dialog open={claimOpen} onOpenChange={setClaimOpen}><DialogContent><DialogHeader><DialogTitle>Futures Copy Trading</DialogTitle><DialogDescription>The 10 USDT loss-protection offer is not active on Velocity Trade. Copy trading and reward claims are not currently available; no reward has been credited.</DialogDescription></DialogHeader><Button variant="secondary" onClick={() => setClaimOpen(false)}>Close</Button></DialogContent></Dialog>
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <Button variant="ghost" onClick={onDeposit} className="exchange-widget h-auto min-h-36 min-w-0 flex-col items-start justify-between gap-1 whitespace-normal rounded-lg bg-surface p-3 text-left hover:bg-surface-raised sm:min-h-44">
        <span className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full border border-border bg-surface-raised"><DollarSign className="size-4" /></span><span className="text-xs font-medium">USD</span></span>
        <span className="mt-2 block"><span className="text-[10px] font-medium text-bull">Deposit</span><span className="mt-0.5 block text-sm font-semibold leading-5">External Wallet Transfer</span></span>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Deposit USDT, BTC, ETH via blockchain networks</span>
        <span className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground">Crypto deposit <ChevronRight className="size-3 shrink-0" /></span>
      </Button>
      <Link to="/terminal/$symbol" params={{ symbol: "BTCUSDT" }} className="exchange-widget flex min-h-36 min-w-0 flex-col overflow-hidden rounded-lg bg-surface p-3 transition-colors hover:bg-surface-raised sm:min-h-44">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><AssetIcon symbol="BTCUSDT" size={24} />BTC</span>
        <span className="mt-3 text-lg leading-6 font-semibold tabular-nums">{live ? formatPrice(quote.price, "BTCUSDT") : "-"}</span>
        <span className={`text-xs ${up ? "text-bull" : "text-bear"}`}>{live ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "Price unavailable"}</span>
        <div className={`mt-auto h-12 w-full pt-2 ${up ? "text-bull" : "text-bear"}`}>
          {points ? <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="BTC last 24 hourly prices"><polygon points={`0,80 ${points} 240,80`} fill="currentColor" opacity="0.08" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : <span className="text-[10px] text-muted-foreground">Chart unavailable</span>}
        </div>
      </Link>
    </div>
  </div>;
}