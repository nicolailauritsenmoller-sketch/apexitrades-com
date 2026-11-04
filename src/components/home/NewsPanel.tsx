import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, Eye, Heart, MessageCircle, Newspaper, Repeat2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getDiscoveryNews, type NewsItem } from "@/lib/news.functions";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import { INSTRUMENT_MAP } from "@/lib/instruments";
import { sparklinePoints } from "@/lib/home-markets";

const filters = ["All", "Crypto", "TradFi", "Macro"] as const;
const relativeTime = (date: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(date)) / 60_000));
  return minutes < 60 ? `${minutes}m` : minutes < 1440 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
};

function NewsChart({ symbol }: { symbol: string }) {
  const candles = useCandles(symbol, "1h");
  const values = (candles.data ?? []).slice(-24).map(candle => candle.c);
  if (values.length < 2) return null;
  const up = values[values.length - 1] >= values[0];
  return <figure className="my-3 border-y border-border py-3">
    <figcaption className="flex justify-between text-[11px] text-muted-foreground"><span>{symbol.replace(/USDT$/, " / USDT")} · Live market context</span><span>24h · 1h closes</span></figcaption>
    <svg viewBox="0 0 240 80" preserveAspectRatio="none" className="mt-2 h-28 w-full" role="img" aria-label={`${symbol} last 24 hourly closing prices`}><polyline points={sparklinePoints(values)} fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" className={up ? "stroke-bull" : "stroke-bear"} /></svg>
  </figure>;
}

function NewsCard({ item }: { item: NewsItem }) {
  const [liked, setLiked] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { try { setLiked(localStorage.getItem(`news-like:${item.id}`) === "1"); } catch { /* Storage unavailable. */ } }, [item.id]);
  const tickers = item.tickers.filter(symbol => Boolean(INSTRUMENT_MAP[symbol]));
  const { quotes } = useQuotes(tickers, 5000);
  let sourceVerified = false;
  try { const host = new URL(item.url).hostname.replace(/^www\./, ""); sourceVerified = Boolean(item.domain) && (host === item.domain || host.endsWith(`.${item.domain}`)); } catch { /* No verified publisher link. */ }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: item.title, url: item.url });
      else { await navigator.clipboard.writeText(item.url); toast.success("Article link copied"); }
    } catch { /* User cancelled sharing. */ }
  }
  return <article className="rounded-lg border border-border bg-card p-4 touch-manipulation">
    <header className="flex items-start gap-2.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-border bg-secondary"><Newspaper className="size-4 text-muted-foreground" /></span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold">{item.source}</a>{sourceVerified && <BadgeCheck className="size-3.5 text-ops-blue" aria-label="Publisher domain verified" />}<span className="text-[11px] text-muted-foreground">· {relativeTime(item.publishedAt)}</span></div><span className="text-[10px] text-muted-foreground">{item.domain || "Publisher article"}</span></div>
      <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">Article</span>
    </header>
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="mt-3 block"><h3 className="text-base font-semibold leading-6"><span className="text-muted-foreground">{["crypto", "defi"].includes(item.category) ? "Crypto News" : item.category === "macro" ? "Macro News" : "TradFi News"} | </span>{item.title}</h3></a>
    {item.excerpt && <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.excerpt}</p>}
    {item.image && !imageFailed ? <img src={item.image} alt={item.title} loading="lazy" referrerPolicy="no-referrer" className="mt-3 aspect-video w-full rounded-md object-contain bg-secondary" onError={() => setImageFailed(true)} /> : tickers[0] ? <NewsChart symbol={tickers[0]} /> : null}
    <div className="mt-3 flex flex-wrap gap-2">{tickers.map(symbol => {
      const quote = quotes[symbol];
      const live = quote && !quote.stale && Number.isFinite(quote.changePercent);
      return <Button key={symbol} asChild variant="secondary" size="sm" className="h-9 gap-2 px-2.5 text-[11px]"><Link to="/terminal/$symbol" params={{ symbol }}><span>{symbol.replace(/USDT$/, "")}</span><span className={live ? quote.changePercent >= 0 ? "text-bull" : "text-bear" : "text-muted-foreground"}>{live ? `${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "-"}</span></Link></Button>;
    })}</div>
    <footer className="mt-3 flex items-center justify-between border-t border-border pt-2 text-muted-foreground">
      <Button asChild variant="ghost" size="sm" className="h-10 gap-1 px-2" title="Read comments at the publisher; count unavailable"><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`Read comments on ${item.source}`}><MessageCircle className="size-4" /><span className="text-[11px]">-</span></a></Button>
      <Button variant="ghost" size="sm" className="h-10 gap-1 px-2" aria-label="Share or repost article" title="Share or repost article; publisher count unavailable" onClick={() => void share()}><Repeat2 className="size-4" /><span className="text-[11px]">-</span></Button>
      <Button variant="ghost" size="sm" className={`h-10 gap-1 px-2 ${liked ? "text-bear" : ""}`} aria-label={liked ? "Unlike article" : "Like article"} aria-pressed={liked} title="Save your like; publisher count unavailable" onClick={() => { const next = !liked; setLiked(next); try { localStorage.setItem(`news-like:${item.id}`, next ? "1" : "0"); } catch { /* Local feedback still works. */ } }}><Heart className={`size-4 ${liked ? "fill-current" : ""}`} /><span className="text-[11px]">-</span></Button>
      <span className="flex h-10 items-center gap-1 px-2 text-[11px]" title="Publisher view count unavailable" aria-label="Views count unavailable"><Eye className="size-4" />-</span>
      <Button asChild variant="ghost" size="icon" className="size-10" title="Read full article"><a href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Read full article"><ExternalLink className="size-4" /></a></Button>
    </footer>
  </article>;
}

export function NewsPanel() {
  const [filter, setFilter] = useState<typeof filters[number]>("All");
  const [limit, setLimit] = useState(12);
  const fetchNews = useServerFn(getDiscoveryNews);
  const feed = useQuery({ queryKey: ["discovery-news"], queryFn: () => fetchNews(), refetchInterval: 120_000, staleTime: 120_000 });
  const rows = (feed.data ?? []).filter(item => filter === "All" || (filter === "Crypto" ? ["crypto", "defi"].includes(item.category) : filter === "Macro" ? item.category === "macro" : !["crypto", "defi", "macro"].includes(item.category)));
  return <div className="space-y-3">
    <header className="flex items-center justify-between"><h2 className="text-lg font-semibold">Velocity News</h2><Button variant="ghost" size="icon" aria-label="Refresh news" title="Refresh news" disabled={feed.isFetching} onClick={() => void feed.refetch()}><RefreshCw className={feed.isFetching ? "animate-spin" : ""} /></Button></header>
    <div role="tablist" aria-label="News categories" className="flex gap-1 border-b border-border">{filters.map(value => <Button key={value} variant="ghost" role="tab" aria-selected={filter === value} className={`h-10 px-3 text-xs ${filter === value ? "border-b-2 border-foreground rounded-none font-semibold" : "text-muted-foreground"}`} onClick={() => { setFilter(value); setLimit(12); }}>{value}</Button>)}</div>
    {feed.isPending && <p className="py-10 text-center text-sm text-muted-foreground">Loading financial news...</p>}
    {!feed.isPending && !rows.length && <div className="py-10 text-center"><p className="text-sm text-muted-foreground">No fresh articles available in this category.</p><Button variant="ghost" className="mt-2" onClick={() => void feed.refetch()}><RefreshCw />Retry</Button></div>}
    {rows.slice(0, limit).map(item => <NewsCard key={item.id} item={item} />)}
    {rows.length > limit && <Button variant="secondary" className="w-full" onClick={() => setLimit(value => value + 12)}>Load more articles</Button>}
  </div>;
}