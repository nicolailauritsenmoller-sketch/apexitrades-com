import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { useQuotes } from "@/hooks/useMarket";
import { AssetIcon } from "@/lib/asset-icons";
import { getMarketNews } from "@/lib/news.functions";
import type { Quote } from "@/lib/market-types";
import { Button } from "@/components/ui/button";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "DOGEUSDT", "XRPUSDT", "SOLUSDT"];
type Pulse = { id: string; symbol: string; title: string; detail: string; tone: "up" | "down" | "neutral"; at: string };

export function useMarketPulses() {
  const market = useQuotes(SYMBOLS, 5000);
  const previous = useRef<Record<string, Quote>>({});
  const signatures = useRef<Record<string, string>>({});
  const [pulses, setPulses] = useState<Pulse[]>([]);
  useEffect(() => {
    const next: Pulse[] = [];
    for (const q of market.list) {
      if (q.stale || !Number.isFinite(q.price) || q.price <= 0) continue;
      const prior = previous.current[q.symbol];
      const movement = prior ? (q.price / prior.price - 1) * 100 : 0;
      const range = q.low > 0 ? (q.high / q.low - 1) * 100 : 0;
      const breakout = prior && prior.high > 0 && q.price > prior.high && prior.price < prior.high;
      const kind = breakout ? "breakout" : Math.abs(movement) >= 0.5 ? (movement > 0 ? "surge" : "dip") : q.changePercent >= 3 ? "daily-surge" : q.changePercent <= -3 ? "daily-dip" : range >= 5 ? "volatility" : "steady";
      previous.current[q.symbol] = q;
      if (kind === "steady" || signatures.current[q.symbol] === kind) continue;
      signatures.current[q.symbol] = kind;
      const intraday = kind === "surge" || kind === "dip";
      next.push({ id: `${q.symbol}-${Date.now()}-${kind}`, symbol: q.symbol,
        title: kind === "breakout" ? "Bullish breakout above observed high" : kind === "volatility" ? "Elevated volatility" : kind.includes("dip") ? "Sharp price decline" : "Price surge",
        detail: kind === "breakout" ? `Price crossed the previously observed 24h high of ${prior?.high.toLocaleString()} USDT.` : kind === "volatility" ? `${range.toFixed(2)}% high-to-low range over 24h.` : `${(intraday ? movement : q.changePercent) > 0 ? "+" : ""}${(intraday ? movement : q.changePercent).toFixed(2)}% ${intraday ? "since the previous live update" : "over 24h"}.`,
        tone: kind.includes("dip") ? "down" : kind === "volatility" ? "neutral" : "up", at: new Date().toISOString() });
    }
    if (next.length) setPulses((rows) => [...next, ...rows].slice(0, 40));
  }, [market.list]);
  return { ...market, pulses };
}

export function MarketIntelligence({ market }: { market: ReturnType<typeof useMarketPulses> }) {
  const fetchNews = useServerFn(getMarketNews);
  const news = useQuery({ queryKey: ["market-news"], queryFn: () => fetchNews(), staleTime: 60_000, refetchInterval: 60_000 });
  const headlines = (news.data ?? []).filter((n) => ["crypto", "macro", "regulation"].includes(n.category)).slice(0, 8);
  return <div className="divide-y divide-border">
    <section className="px-5 py-4">
      <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground"><span>Market monitor</span><span>24h change</span></div>
      {market.isLoading && <p className="py-4 text-xs text-muted-foreground">Loading market data...</p>}
      {!market.isLoading && !market.list.length && <p className="py-4 text-xs text-muted-foreground">Market data temporarily unavailable.</p>}
      {market.list.map((q) => <Link key={q.symbol} to="/terminal/$symbol" params={{ symbol: q.symbol }} className="flex min-h-12 items-center gap-3 border-b border-border/60 py-2 last:border-0 hover:bg-secondary/50">
        <AssetIcon symbol={q.symbol} className="size-7" /><span className="flex-1 text-xs font-semibold">{q.symbol.replace("USDT", "")}</span>
        <span className="text-right font-mono text-xs">{q.price.toLocaleString(undefined, { maximumFractionDigits: q.price < 1 ? 5 : 2 })}<span className="ml-1 text-[10px] text-muted-foreground">USDT</span>{q.stale && <span className="block text-[10px] text-muted-foreground">Delayed</span>}</span>
        <span className={`w-20 text-right font-mono text-xs ${q.changePercent >= 0 ? "text-bull" : "text-bear"}`}>{q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%</span>
      </Link>)}
    </section>
    <section className="px-5 py-4"><h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Movement alerts</h3>
      {!market.pulses.length && <p className="text-xs text-muted-foreground">No qualifying movement alerts.</p>}
      {market.pulses.map((p) => { const Icon = p.tone === "up" ? TrendingUp : p.tone === "down" ? TrendingDown : Activity; return <Link key={p.id} to="/terminal/$symbol" params={{ symbol: p.symbol }} className="flex gap-3 border-b border-border py-3 last:border-0 hover:bg-secondary/50">
        <Icon className={`mt-0.5 size-4 shrink-0 ${p.tone === "up" ? "text-bull" : p.tone === "down" ? "text-bear" : "text-muted-foreground"}`} />
        <div className="min-w-0"><div className="mb-1 flex gap-2 text-[10px] text-muted-foreground"><span className="font-semibold text-foreground">{p.symbol.replace("USDT", "")}</span><time>{new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p className="text-xs font-semibold">{p.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.detail}</p></div>
      </Link>; })}
    </section>
    <section className="px-5 py-4"><h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">Macro & crypto intelligence</h3>
      {news.isPending && <p className="text-xs text-muted-foreground">Loading intelligence...</p>}
      {(news.isError || (!news.isPending && !headlines.length)) && <p className="text-xs text-muted-foreground">Intelligence feed temporarily unavailable.</p>}
      {headlines.map((n) => <Button key={n.id} asChild variant="ghost" className="h-auto w-full justify-start whitespace-normal rounded-none border-b border-border px-0 py-3 text-left last:border-0"><a href={n.url} target="_blank" rel="noopener noreferrer"><span className="min-w-0 flex-1"><span className="mb-1 block text-[10px] font-normal text-muted-foreground">{n.source} · {new Date(n.publishedAt).toLocaleDateString()}</span><span className="line-clamp-3 text-xs leading-relaxed">{n.title}</span></span><ArrowUpRight className="text-muted-foreground" /></a></Button>)}
    </section>
  </div>;
}