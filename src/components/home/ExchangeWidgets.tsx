import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { BadgePercent, ChevronRight, Landmark, ShieldCheck, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TradingProgramDialog, type TradingProgram } from "./TradingProgramDialog";
import { usePreference } from "@/lib/preferences";
import { AssetIcon } from "@/lib/asset-icons";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import { formatPrice } from "@/lib/instruments";
import { sparklinePoints } from "@/lib/home-markets";

const PROMOS = [
  {
    kicker: "Copy trading enrollment - Execution pending",
    icon: ShieldCheck,
    iconClass: "text-warning",
    title: "Start Futures Copy Trading",
    subtitle: "Explore trader enrollment and copy preferences",
    action: "claim" as const,
    actionLabel: "Claim",
  },
  {
    kicker: "VIP fee privileges",
    icon: BadgePercent,
    iconClass: "text-primary",
    title: "Lower Spot Trading Fees",
    subtitle: "VIP tiers cut your trading fees",
    action: "vip" as const,
    actionLabel: "View VIP",
  },
  {
    kicker: "Proposed tournament",
    icon: Trophy,
    iconClass: "text-bull",
    title: "Global Trading Tournament",
    subtitle: "Proposed 50,000 USDT Prize Pool",
    action: "tournament" as const,
    actionLabel: "Join Now",
  },
  {
    kicker: "Proposed liquidity program",
    icon: Landmark,
    iconClass: "text-muted-foreground",
    title: "Institutional Liquidity Program",
    subtitle: "Proposed zero-fee maker orders for qualified accounts",
    action: "liquidity" as const,
    actionLabel: "Apply",
  },
];

/** Circular fiat emblem sized and finished to match the crypto coin badges. */
function FiatEmblem() {
  return (
    <span
      className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-raised ring-1 ring-border"
      aria-hidden="true"
    >
      <span className="grid size-[17px] place-items-center rounded-full border border-border bg-surface">
        <span className="font-mono text-[10px] leading-none font-semibold text-foreground">$</span>
      </span>
    </span>
  );
}

export function ExchangeWidgets({ onDeposit }: { onDeposit: () => void }) {
  const [dismissed, setDismissed] = usePreference("dismissedOnboarding", []);
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [program, setProgram] = useState<TradingProgram | null>(null);
  const { quotes } = useQuotes(["BTCUSDT"], 5000);
  const candles = useCandles("BTCUSDT", "1h");
  const quote = quotes.BTCUSDT;
  const live = quote && !quote.stale;
  const up = (quote?.changePercent ?? 0) >= 0;
  const closes = (candles.data ?? []).slice(-24).map(candle => candle.c);
  if (live && closes.length) closes[closes.length - 1] = quote.price;
  const points = sparklinePoints(closes);

  function activeIndexFromScroll() {
    const el = trackRef.current;
    if (!el) return;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    Array.from(el.children).forEach((child, index) => {
      const dist = Math.abs((child as HTMLElement).offsetLeft - el.offsetLeft - el.scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = index;
      }
    });
    setActive(best);
  }

  function goTo(index: number) {
    const el = trackRef.current;
    const target = el?.children[index] as HTMLElement | undefined;
    if (!el || !target) return;
    const instant = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: instant ? "instant" : "smooth" });
  }

  return <div className="exchange-widgets space-y-3">
    {!dismissed.includes("exchange-futures-promo") && (
      <article className="relative rounded-lg border border-border bg-surface px-3 py-2" aria-label="Exchange promotions">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-muted-foreground">{PROMOS[active].kicker}</p>
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" aria-label="Dismiss promotions" onClick={() => setDismissed([...dismissed, "exchange-futures-promo"])}><X /></Button>
        </div>
        <div
          ref={trackRef}
          onScroll={activeIndexFromScroll}
          className="no-scrollbar mt-1 flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain scroll-smooth touch-pan-x motion-reduce:scroll-auto"
          role="group"
          aria-label="Promotion carousel"
        >
          {PROMOS.map(promo => (
            <div key={promo.kicker} className="grid min-h-14 w-full shrink-0 snap-start grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
              <promo.icon className={`size-6 shrink-0 ${promo.iconClass}`} />
              <div className="min-w-0">
                {promo.action !== "vip" ? <Button variant="ghost" className="h-auto w-full flex-col items-start gap-0 whitespace-normal p-0 text-left hover:bg-transparent" onClick={() => setProgram(promo.action === "claim" ? "copy_trading" : promo.action)}>
                <h2 className="text-[12px] leading-4 font-semibold">{promo.title}</h2>
                <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{promo.subtitle}</p>
                </Button> : <><h2 className="text-[12px] leading-4 font-semibold">{promo.title}</h2><p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">{promo.subtitle}</p></>}
              </div>
              {promo.action === "vip" ? (
                <Button asChild variant="secondary" size="sm" className="min-h-10 shrink-0 text-xs"><Link to="/vip-upgrade">{promo.actionLabel}</Link></Button>
              ) : (
                <Button size="sm" variant="secondary" className="min-h-10 shrink-0 px-3 text-xs" onClick={() => setProgram(promo.action === "claim" ? "copy_trading" : promo.action)}>{promo.actionLabel}</Button>
              )}
            </div>
          ))}
        </div>
        <div className="-my-1 flex justify-center" role="group" aria-label="Promotion pagination">
          {PROMOS.map((promo, index) => (
            <Button key={promo.kicker} variant="ghost" size="icon" className="size-8" aria-label={`Show promotion ${index + 1}`} aria-pressed={active === index} onClick={() => goTo(index)}>
              <span className={`h-1 rounded-full transition-all ${active === index ? "w-3 bg-foreground" : "w-1 bg-muted-foreground/40"}`} />
            </Button>
          ))}
        </div>
      </article>
    )}
    <TradingProgramDialog key={program ?? "closed"} program={program} onClose={() => setProgram(null)} />
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <Button variant="ghost" onClick={onDeposit} className="exchange-widget h-auto min-h-36 min-w-0 flex-col items-start justify-between gap-1 whitespace-normal rounded-lg bg-surface p-3 text-left hover:bg-surface-raised sm:min-h-44">
        <span className="flex items-center gap-2"><FiatEmblem /><span className="text-xs font-medium tracking-normal text-muted-foreground uppercase">USD</span></span>
        <span className="mt-2 block"><span className="text-[10px] font-medium text-bull">Deposit</span><span className="mt-0.5 block text-sm font-semibold leading-5">Deposit Crypto</span></span>
        <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Instant on-chain settlement</span>
        <span className="mt-1 flex w-full items-center justify-between text-[10px] text-muted-foreground">Crypto deposit <ChevronRight className="size-3 shrink-0" /></span>
      </Button>
      <Link to="/terminal/$symbol" params={{ symbol: "BTCUSDT" }} className="exchange-widget flex min-h-36 min-w-0 flex-col overflow-hidden rounded-lg bg-surface p-3 transition-colors hover:bg-surface-raised sm:min-h-44">
        <span className="flex items-center gap-2 text-xs text-muted-foreground"><AssetIcon symbol="BTCUSDT" size={24} />BTC</span>
        <span className="num mt-3 text-lg leading-6 font-semibold tracking-normal">{live ? formatPrice(quote.price, "BTCUSDT") : "-"}</span>
        <span className={`num text-xs tracking-normal ${up ? "text-bull" : "text-bear"}`}>{live ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "Price unavailable"}</span>
        <div className={`mt-auto h-12 w-full pt-2 ${up ? "text-bull" : "text-bear"}`}>
          {points ? <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="BTC last 24 hourly prices"><polygon points={`0,80 ${points} 240,80`} fill="currentColor" opacity="0.08" /><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" /></svg> : <span className="text-[10px] text-muted-foreground">Chart unavailable</span>}
        </div>
      </Link>
    </div>
  </div>;
}
