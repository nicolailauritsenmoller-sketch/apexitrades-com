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
import { useMarketInsights } from "@/lib/use-market-insights";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "DOGEUSDT", "XRPUSDT", "SOLUSDT"];
type Pulse = {
  id: string;
  symbol: string;
  title: string;
  detail: string;
  tone: "up" | "down" | "neutral";
  at: string;
};

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
      const kind = breakout
        ? "breakout"
        : Math.abs(movement) >= 0.5
          ? movement > 0
            ? "surge"
            : "dip"
          : q.changePercent >= 3
            ? "daily-surge"
            : q.changePercent <= -3
              ? "daily-dip"
              : range >= 5
                ? "volatility"
                : "steady";
      previous.current[q.symbol] = q;
      if (kind === "steady" || signatures.current[q.symbol] === kind) continue;
      signatures.current[q.symbol] = kind;
      const intraday = kind === "surge" || kind === "dip";
      next.push({
        id: `${q.symbol}-${Date.now()}-${kind}`,
        symbol: q.symbol,
        title:
          kind === "breakout"
            ? "Bullish breakout above observed high"
            : kind === "volatility"
              ? "Elevated volatility"
              : kind.includes("dip")
                ? "Sharp price decline"
                : "Price surge",
        detail:
          kind === "breakout"
            ? `Price crossed the previously observed 24h high of ${prior?.high.toLocaleString()} USDT.`
            : kind === "volatility"
              ? `${range.toFixed(2)}% high-to-low range over 24h.`
              : `${(intraday ? movement : q.changePercent) > 0 ? "+" : ""}${(intraday ? movement : q.changePercent).toFixed(2)}% ${intraday ? "since the previous live update" : "over 24h"}.`,
        tone: kind.includes("dip") ? "down" : kind === "volatility" ? "neutral" : "up",
        at: new Date().toISOString(),
      });
    }
    if (next.length) setPulses((rows) => [...next, ...rows].slice(0, 40));
  }, [market.list]);
  return { ...market, pulses };
}

const TRUSTED = /tradingview|binance|kraken|coingecko|coinmarketcap|crypto\.com|coindesk|bloomberg|reuters/i;
const COMMENTARY =
  /\b(outlook|analysis|forecast|predict\w*|expect\w*|support|resistance|level|breakout|trend|technical|strategy|sentiment|psycholog\w*|risk|macro|fed|rally|correction|momentum|liquidity|weekly|outlook)\b/i;

/** Ranks headlines toward trusted-source commentary: trend, levels, macro and strategy. */
function rankCommentary<T extends { source: string; title: string; category: string; publishedAt: string }>(items: T[]): T[] {
  return items
    .filter((n) => ["crypto", "macro", "regulation", "defi"].includes(n.category))
    .map((n) => ({
      n,
      score:
        (TRUSTED.test(n.source) ? 2 : 0) +
        (COMMENTARY.test(n.title) ? 2 : 0) +
        new Date(n.publishedAt).getTime() / 864e8 / 1e6,
    }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score || +new Date(b.n.publishedAt) - +new Date(a.n.publishedAt))
    .map((x) => x.n);
}

export function MarketIntelligence({ market }: { market: ReturnType<typeof useMarketPulses> }) {
  const fetchNews = useServerFn(getMarketNews);
  const news = useQuery({
    queryKey: ["market-news"],
    queryFn: () => fetchNews(),
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const insights = useMarketInsights("comms-market-insights");
  const headlines = rankCommentary(news.data ?? []).slice(0, 10);
  return (
    <div className="divide-y divide-border">
      {!!insights.data?.length && (
        <section className="px-5 py-4">
          <h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
            Desk intelligence
          </h3>
          {insights.data.map((i) => (
            <article key={i.id} className="border-b border-border py-3 last:border-0">
              <p className="mb-1 text-[10px] text-muted-foreground">
                <span className="font-semibold uppercase text-foreground">{i.category}</span> · {i.source} ·{" "}
                {new Date(i.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <p className="text-xs font-semibold">{i.title}</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{i.content}</p>
            </article>
          ))}
        </section>
      )}
      <section className="px-5 py-4">
        <h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          Movement alerts
        </h3>
        {!market.pulses.length && (
          <p className="text-xs text-muted-foreground">No qualifying movement alerts.</p>
        )}
        {market.pulses.map((p) => {
          const Icon = p.tone === "up" ? TrendingUp : p.tone === "down" ? TrendingDown : Activity;
          return (
            <Link
              key={p.id}
              to="/terminal/$symbol"
              params={{ symbol: p.symbol }}
              className="flex gap-3 border-b border-border py-3 last:border-0 hover:bg-secondary/50"
            >
              <Icon
                className={`mt-0.5 size-4 shrink-0 ${p.tone === "up" ? "text-bull" : p.tone === "down" ? "text-bear" : "text-muted-foreground"}`}
              />
              <div className="min-w-0">
                <div className="mb-1 flex gap-2 text-[10px] text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    {p.symbol.replace("USDT", "")}
                  </span>
                  <time>
                    {new Date(p.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </time>
                </div>
                <p className="text-xs font-semibold">{p.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{p.detail}</p>
              </div>
            </Link>
          );
        })}
      </section>
      <section className="px-5 py-4">
        <h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          Trading commentary & outlooks
        </h3>
        {news.isPending && <p className="text-xs text-muted-foreground">Loading intelligence...</p>}
        {(news.isError || (!news.isPending && !headlines.length)) && (
          <p className="text-xs text-muted-foreground">
            Intelligence feed temporarily unavailable.
          </p>
        )}
        {headlines.map((n) => (
          <Button
            key={n.id}
            asChild
            variant="ghost"
            className="h-auto w-full justify-start whitespace-normal rounded-none border-b border-border px-0 py-3 text-left last:border-0"
          >
            <a href={n.url} target="_blank" rel="noopener noreferrer">
              <span className="min-w-0 flex-1">
                <span className="mb-1 block text-[10px] font-normal text-muted-foreground">
                  {n.source} · {new Date(n.publishedAt).toLocaleDateString()}
                </span>
                <span className="line-clamp-3 text-xs leading-relaxed">{n.title}</span>
              </span>
              <ArrowUpRight className="text-muted-foreground" />
            </a>
          </Button>
        ))}
      </section>
    </div>
  );
}
