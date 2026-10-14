import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, TrendingDown, TrendingUp, Activity } from "lucide-react";
import { useQuotes } from "@/hooks/useMarket";
import { AssetIcon } from "@/lib/asset-icons";
import { getExpertCommentary } from "@/lib/news.functions";
import {
  COMMENTARY_ROTATION_MS,
  commentaryPage,
  commentaryTopics,
  rankExpertCommentary,
} from "@/lib/market-commentary";
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

// Module-level store: survives AppShell remounts on page navigation so
// already-detected/seen pulses are not re-created as new unread alerts.
const pulseStore = {
  previous: {} as Record<string, Quote>,
  signatures: {} as Record<string, string>,
  pulses: [] as Pulse[],
  seen: new Set<string>(),
};
const SEEN_KEY = "velocity:seen-pulses";
if (typeof window !== "undefined") {
  try {
    for (const id of JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? "[]")) pulseStore.seen.add(id);
  } catch {
    /* ignore */
  }
}

export function useMarketPulses() {
  const market = useQuotes(SYMBOLS, 5000);
  const previous = useRef(pulseStore.previous);
  const signatures = useRef(pulseStore.signatures);
  const [pulses, setPulsesState] = useState<Pulse[]>(pulseStore.pulses);
  const [seen, setSeen] = useState<Set<string>>(pulseStore.seen);
  const setPulses = (fn: (rows: Pulse[]) => Pulse[]) =>
    setPulsesState((rows) => (pulseStore.pulses = fn(rows)));
  const markSeen = useCallback((ids: string[]) => {
    if (ids.every((id) => pulseStore.seen.has(id))) return;
    ids.forEach((id) => pulseStore.seen.add(id));
    try {
      sessionStorage.setItem(SEEN_KEY, JSON.stringify([...pulseStore.seen].slice(-200)));
    } catch {
      /* ignore */
    }
    setSeen(new Set(pulseStore.seen));
  }, []);
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
  return { ...market, pulses, seen, markSeen };
}

export function MarketIntelligence({ market }: { market: ReturnType<typeof useMarketPulses> }) {
  const fetchNews = useServerFn(getExpertCommentary);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setCycle((value) => value + 1), COMMENTARY_ROTATION_MS);
    return () => window.clearInterval(timer);
  }, []);
  const news = useQuery({
    queryKey: ["expert-commentary"],
    queryFn: () => fetchNews(),
    staleTime: COMMENTARY_ROTATION_MS,
    refetchInterval: COMMENTARY_ROTATION_MS,
  });
  const insights = useMarketInsights("comms-market-insights");
  const headlines = commentaryPage(rankExpertCommentary(news.data ?? []), cycle);
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
                <span className="font-semibold uppercase text-foreground">{i.category}</span> ·{" "}
                {i.source} ·{" "}
                {new Date(i.created_at).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p className="text-xs font-semibold">{i.title}</p>
              <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                {i.content}
              </p>
            </article>
          ))}
        </section>
      )}
      <section className="px-5 py-4">
        <h3 className="mb-3 text-[10px] uppercase tracking-widest text-muted-foreground">
          Movement alerts
        </h3>
        <BtcMovementCard quote={market.list.find((q) => q.symbol === "BTCUSDT")} />
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
            No verified asset commentary is available right now.
          </p>
        )}
        <div
          key={cycle}
          className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          data-commentary-cycle={cycle}
        >
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
                  <span className="mb-1 block text-[10px] font-medium text-muted-foreground">
                    {n.tickers
                      .filter((symbol) =>
                        ["BTCUSDT", "ETHUSDT", "XRPUSDT", "SOLUSDT", "BNBUSDT"].includes(symbol),
                      )
                      .map((symbol) => symbol.replace("USDT", ""))
                      .join(" · ")}
                    {commentaryTopics(n).length > 0 && ` / ${commentaryTopics(n).join(" · ")}`}
                  </span>
                  <span className="line-clamp-3 text-xs leading-relaxed">{n.title}</span>
                  {n.excerpt && (
                    <span className="mt-1 block line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">
                      {n.excerpt}
                    </span>
                  )}
                </span>
                <ArrowUpRight className="text-muted-foreground" />
              </a>
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Always-on BTC card: live 24h change, range and position within the range. */
function BtcMovementCard({ quote: q }: { quote?: Quote }) {
  if (!q || q.stale || !(q.price > 0)) {
    return (
      <div className="mb-3 rounded-md border border-border p-3 text-xs text-muted-foreground">
        BTC live data unavailable right now.
      </div>
    );
  }
  const range = q.low > 0 ? (q.high / q.low - 1) * 100 : 0;
  const pos = q.high > q.low ? ((q.price - q.low) / (q.high - q.low)) * 100 : 50;
  const state =
    q.changePercent >= 3
      ? "Price surge"
      : q.changePercent <= -3
        ? "Sharp price decline"
        : pos >= 98
          ? "Testing 24h high"
          : pos <= 2
            ? "Testing 24h low"
            : range >= 5
              ? "Elevated volatility"
              : "Range-bound";
  const tone = q.changePercent > 0 ? "text-bull" : q.changePercent < 0 ? "text-bear" : "text-muted-foreground";
  const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return (
    <Link
      to="/terminal/$symbol"
      params={{ symbol: "BTCUSDT" }}
      className="mb-3 block touch-manipulation rounded-md border border-border p-3 hover:bg-secondary/50"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <AssetIcon symbol="BTCUSDT" size={16} /> BTC · {state}
        </span>
        <span className={`font-mono text-xs font-semibold ${tone}`}>
          {q.changePercent > 0 ? "+" : ""}
          {q.changePercent.toFixed(2)}%
        </span>
      </div>
      <p className="font-mono text-sm font-semibold">{fmt(q.price)} USDT</p>
      <div className="mt-2 h-1 rounded-full bg-secondary">
        <div className="h-1 rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, pos))}%` }} />
      </div>
      <p className="mt-1 flex justify-between font-mono text-[10px] text-muted-foreground">
        <span>L {fmt(q.low)}</span>
        <span>24h range {range.toFixed(2)}%</span>
        <span>H {fmt(q.high)}</span>
      </p>
    </Link>
  );
}
