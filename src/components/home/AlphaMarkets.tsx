import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ChartNoAxesCombined, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CandleChart } from "@/components/CandleChart";
import { getAlpha, getAlphaChart } from "@/lib/alpha.functions";
import { ALPHA_REFRESH_MS, alphaRows, type AlphaToken, type AlphaFilter } from "@/lib/alpha";
import { compactUsd } from "@/lib/home-markets";
import { ListingLogo } from "./ListingLogo";
import { ALPHA_LOGOS } from "@/lib/alpha-logo-registry";

const columns = "grid grid-cols-[minmax(0,1fr)_85px_66px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_90px_70px_80px_85px_108px]";
const price = (value: number) => `$${value.toLocaleString("en-US", { maximumFractionDigits: value < 1 ? 8 : 4 })}`;

function AlphaPreview({ token }: { token: AlphaToken }) {
  const [interval, setInterval] = useState<"15m" | "1h">("1h");
  const fetchChart = useServerFn(getAlphaChart);
  const chart = useQuery({ queryKey: ["alpha-chart", token.tokenId, interval], queryFn: () => fetchChart({ data: { tokenId: token.tokenId, interval } }), staleTime: 20_000, refetchInterval: ALPHA_REFRESH_MS });
  return <>
    <DialogHeader><div className="flex items-center gap-3 pr-6"><ListingLogo ticker={token.ticker} name={token.name} logoUrl={ALPHA_LOGOS[token.tokenId] ?? token.logoUrl} /><DialogTitle>{token.name}</DialogTitle></div><DialogDescription>{token.ticker} · {token.chain} · Alpha market intelligence</DialogDescription></DialogHeader>
    <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Last Price (USD)</dt><dd className="num text-sm">{price(token.price)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">24h Change</dt><dd className={`num text-sm ${token.changePercent >= 0 ? "text-bull" : "text-bear"}`}>{token.changePercent >= 0 ? "+" : ""}{token.changePercent.toFixed(2)}%</dd></div>
      <div><dt className="text-xs text-muted-foreground">24h Volume</dt><dd className="num text-sm">{compactUsd(token.volume)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Market Cap</dt><dd className="num text-sm">{compactUsd(token.marketCap)}</dd></div>
    </dl>
    <div className="flex items-center justify-between gap-3"><div className="flex gap-2" aria-label="Alpha chart interval">{(["15m", "1h"] as const).map(i => <Button key={i} variant={interval === i ? "secondary" : "ghost"} size="sm" aria-pressed={interval === i} onClick={() => setInterval(i)}>{i}</Button>)}</div><span className="text-xs text-muted-foreground">Liquidity {compactUsd(token.liquidity)}</span></div>
    {chart.isPending ? <div className="grid h-72 place-items-center text-sm text-muted-foreground">Loading live chart...</div> : chart.isError || !chart.data?.candles.length ? <div role="status" className="grid h-72 place-items-center text-sm text-muted-foreground">Live Alpha chart temporarily unavailable.</div> : <div className="min-w-0"><p className="mb-2 text-xs text-muted-foreground">Price in {chart.data.quote}</p><CandleChart candles={chart.data.candles} symbol={token.ticker} height={288} priceFormatter={value => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 8 : 4 })} /></div>}
    <div className="space-y-2 border-t border-border pt-3"><p className="break-all text-[11px] text-muted-foreground">{token.chain} · {token.address}</p><p className="text-xs text-muted-foreground">Early-stage tokens carry elevated volatility and liquidity risk.</p>{token.terminalSymbol ? <Button asChild><Link to="/terminal/$symbol" params={{ symbol: token.terminalSymbol }}>Open Trading Terminal</Link></Button> : <p role="status" className="text-xs text-muted-foreground">Read-only market. Not available for order execution on Velocity Trade.</p>}</div>
  </>;
}

export function AlphaMarkets({ search }: { search: string }) {
  const [filter, setFilter] = useState<AlphaFilter>("Trending");
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<AlphaToken | null>(null);
  const fetchAlpha = useServerFn(getAlpha);
  const feed = useQuery({ queryKey: ["alpha-intelligence"], queryFn: () => fetchAlpha(), refetchInterval: ALPHA_REFRESH_MS, staleTime: 20_000 });
  const fresh = feed.data && Date.now() - feed.data.asOf < 120_000;
  const rows = alphaRows(fresh ? feed.data?.rows ?? [] : [], filter, search, feed.data?.asOf ?? 0);
  return <div role="tabpanel" aria-label="Alpha Crypto markets">
    <div className="flex items-center justify-between gap-2 px-2 py-2 text-[10px] text-muted-foreground"><span>Binance Alpha · On-chain intelligence</span><span className="flex shrink-0 items-center gap-1">{feed.isFetching ? "Updating..." : fresh ? `Updated ${new Date(feed.data?.asOf ?? 0).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Unavailable"}<Button variant="ghost" size="icon" className="size-9" aria-label="Refresh Alpha intelligence" title="Refresh Alpha intelligence" disabled={feed.isFetching} onClick={() => void feed.refetch()}><RefreshCw className={feed.isFetching ? "animate-spin motion-reduce:animate-none" : ""} /></Button></span></div>
    <div className="no-scrollbar flex gap-1 overflow-x-auto px-2" role="tablist" aria-label="Alpha signals">{(["Trending", "Early-stage", "Liquidity", "Momentum"] as const).map(item => <Button key={item} variant={filter === item ? "secondary" : "ghost"} role="tab" aria-selected={filter === item} className="h-10 shrink-0 px-3 text-xs" onClick={() => { setFilter(item); setLimit(12); }}>{item}</Button>)}</div>
    <div className={`${columns} px-2 py-2 text-[11px] text-muted-foreground`}><span>Name</span><span className="text-right">Last Price</span><span className="text-right">24h chg%</span><span className="hidden text-right sm:block">24h Vol</span><span className="hidden text-right sm:block">Market Cap</span><span className="hidden text-right sm:block">Actions</span></div>
    {feed.isPending && <p className="py-10 text-center text-sm text-muted-foreground">Loading live Alpha intelligence...</p>}
    {(feed.isError || feed.data?.unavailable || (!feed.isPending && !fresh)) && <p role="status" className="px-2 py-3 text-xs text-muted-foreground">Live Alpha data temporarily unavailable. Retrying automatically.</p>}
    {!feed.isPending && fresh && !feed.data?.unavailable && !rows.length && <p className="py-10 text-center text-sm text-muted-foreground">No matching Alpha opportunities.</p>}
    {rows.slice(0, limit).map(token => {
      const actions = <><Button variant="ghost" size="icon" className="size-10 text-muted-foreground" aria-label={`View ${token.ticker} Alpha chart`} title={`View ${token.ticker} chart`} onClick={() => setSelected(token)}><ChartNoAxesCombined /></Button>{token.terminalSymbol ? <Button size="sm" className="h-10 px-2" asChild><Link to="/terminal/$symbol" params={{ symbol: token.terminalSymbol }}>Trade</Link></Button> : <Button variant="outline" size="sm" className="h-10 px-2" onClick={() => setSelected(token)}>Details</Button>}</>;
      return <div key={token.tokenId} className={`${columns} border-t border-border/50 px-2 py-3`}>
        <div className="flex min-w-0 items-center gap-2"><ListingLogo ticker={token.ticker} name={token.name} logoUrl={ALPHA_LOGOS[token.tokenId] ?? token.logoUrl} /><div className="min-w-0"><Button variant="link" className="block h-auto max-w-full truncate p-0 text-left text-[13px] font-semibold text-foreground" onClick={() => setSelected(token)}>{token.ticker}</Button><span className="block truncate text-[11px] text-muted-foreground">{token.name}</span><span className="block truncate text-[10px] text-muted-foreground">{token.chain} · Liquidity {compactUsd(token.liquidity)}</span></div></div>
        <span className="num text-right text-[13px]">{price(token.price)}<span className="block text-[10px] text-muted-foreground">USD</span></span>
        <span className={`num text-right text-xs font-semibold ${token.changePercent >= 0 ? "text-bull" : "text-bear"}`}>{token.changePercent >= 0 ? "+" : ""}{token.changePercent.toFixed(2)}%</span>
        <span className="num hidden text-right text-xs sm:block">{compactUsd(token.volume)}</span><span className="num hidden text-right text-xs text-muted-foreground sm:block" title={token.marketCap === null ? "Market capitalization not reported" : "Market capitalization in USD"}>{compactUsd(token.marketCap)}</span>
        <div className="hidden items-center justify-end sm:flex">{actions}</div><div className="col-span-3 flex items-center justify-between gap-2 sm:hidden"><span className="min-w-0 text-[10px] text-muted-foreground">Vol {compactUsd(token.volume)} · Cap {compactUsd(token.marketCap)}</span><div className="flex shrink-0 items-center">{actions}</div></div>
      </div>;
    })}
    {rows.length > limit && <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => setLimit(n => n + 12)}>Show more</Button>}
    <p className="px-2 py-3 text-[10px] text-muted-foreground">High-risk assets · Market observations, not guaranteed returns</p>
    <Dialog open={Boolean(selected)} onOpenChange={open => { if (!open) setSelected(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">{selected && <AlphaPreview key={selected.tokenId} token={feed.data?.rows.find(t => t.tokenId === selected.tokenId) ?? selected} />}</DialogContent></Dialog>
  </div>;
}