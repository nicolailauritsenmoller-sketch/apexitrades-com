import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/lib/asset-icons";
import { INSTRUMENTS, formatPrice } from "@/lib/instruments";
import { useQuotes } from "@/hooks/useMarket";
import { getWatchlist, toggleWatchlist } from "@/lib/trading.functions";
import { HOME_MARKET_TABS, highVolumeSymbols, homeMarketRows, type HomeMarketTab, type HomeMarketClass } from "@/lib/home-markets";

const CATALOG = INSTRUMENTS.filter(i => i.assetClass !== "crypto" || i.symbol.endsWith("USDT"));

export function ExchangeMarkets({ search = "", initialTab = "Hot", initialCategory = "Crypto" }: { search?: string; initialTab?: HomeMarketTab; initialCategory?: HomeMarketClass }) {
  const [tab, setTab] = useState<HomeMarketTab>(initialTab);
  const [category, setCategory] = useState<HomeMarketClass>(initialCategory);
  const [limit, setLimit] = useState(12);
  const fetchWatchlist = useServerFn(getWatchlist);
  const toggle = useServerFn(toggleWatchlist);
  const qc = useQueryClient();
  const watchlist = useQuery({ queryKey: ["watchlist"], queryFn: () => fetchWatchlist() });
  const favorite = useMutation({ mutationFn: (symbol: string) => toggle({ data: { symbol } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["watchlist"] }) });
  const { quotes, isLoading } = useQuotes(CATALOG.filter(i => category === "Crypto" ? i.assetClass === "crypto" : category === "Stocks" ? i.assetClass === "stock" : ["future", "energy", "agriculture", "rate"].includes(i.assetClass)).map(i => i.symbol), 5000);
  const rows = homeMarketRows(CATALOG, quotes, watchlist.data ?? [], tab, category, search);
  const trending = highVolumeSymbols(CATALOG.filter(asset => Boolean(quotes[asset.symbol])), quotes);
  return <section className="exchange-market-list min-w-0 rounded-lg bg-surface px-2 pb-2 pt-1" aria-label="Market overview">
      <div role="tablist" aria-label="Market categories" className="exchange-tabs flex gap-1 overflow-x-auto">
        {HOME_MARKET_TABS.map(item => <Button key={item} role="tab" aria-selected={tab === item} variant="ghost" className={`h-11 shrink-0 px-2.5 text-sm ${tab === item ? "font-semibold text-foreground" : "text-muted-foreground"}`} onClick={() => { setTab(item); setLimit(12); if (item === "TradFi" && category === "Crypto") setCategory("Futures"); }}>{item}</Button>)}
      </div>
      <div role="tablist" aria-label="Asset types" className="flex gap-4 px-2 pt-1">
        {(["Crypto", "Futures", "Stocks"] as const).map(item => <Button key={item} role="tab" aria-selected={category === item} variant="ghost" className={`h-9 px-0 text-[13px] ${category === item ? "text-foreground" : "text-muted-foreground"}`} onClick={() => { setCategory(item); setLimit(12); }}>{item}</Button>)}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_100px_88px] gap-2 px-2 pb-2 pt-2 text-[11px] text-muted-foreground sm:grid-cols-[minmax(0,1fr)_180px_120px]"><span>Name</span><span className="text-right">Last Price</span><span className="text-right">24h chg%</span></div>
      <div role="tabpanel" aria-label={`${tab} ${category} markets`}>
        {isLoading && rows.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Loading markets...</p>}
        {!isLoading && rows.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">{tab === "Alpha" ? "No Alpha listings available." : tab === "New" ? "No newly announced listings." : tab === "Favorites" ? "No favorites in this category." : tab === "Gainers" ? "No live gainers in this category." : "No matching assets."}</p>}
        {rows.slice(0, limit).map(asset => {
          const quote = quotes[asset.symbol];
          const live = quote && !quote.stale;
          const up = (quote?.changePercent ?? 0) >= 0;
          const ticker = asset.symbol.replace(/USDT$/, "");
          const starred = watchlist.data?.includes(asset.symbol) ?? false;
          return <div key={asset.symbol} className="grid grid-cols-[minmax(0,1fr)_100px_88px] items-center gap-2 px-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_180px_120px]">
            <div className="flex min-w-0 items-center gap-2.5">
              <AssetIcon symbol={asset.symbol} size={30} />
              <Link to="/terminal/$symbol" params={{ symbol: asset.symbol }} className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[13px] font-semibold leading-5"><span className="truncate">{ticker}</span>{trending.has(asset.symbol) && <Flame className="size-3.5 shrink-0 fill-market-flame/20 text-market-flame" aria-label="High trading volume" />}</span><span className="mt-0.5 block truncate text-[11px] leading-4 text-muted-foreground">{asset.name}</span></Link>
              <Button variant="ghost" size="icon" aria-label={`${starred ? "Remove" : "Add"} ${ticker} ${starred ? "from" : "to"} favorites`} aria-pressed={starred} disabled={favorite.isPending} className="hidden size-8 text-muted-foreground sm:inline-flex" onClick={() => favorite.mutate(asset.symbol)}><Star className={starred ? "fill-current text-warning" : ""} /></Button>
            </div>
            <Link to="/terminal/$symbol" params={{ symbol: asset.symbol }} className="text-right"><span className="num block text-[13px] font-medium leading-5 tracking-normal">{live ? formatPrice(quote.price, asset.symbol) : "-"}</span><span className="block text-[10px] leading-4 text-muted-foreground">{asset.currency}</span></Link>
            <Link to="/terminal/$symbol" params={{ symbol: asset.symbol }} className={`num flex min-h-9 items-center justify-center rounded-md text-xs font-semibold tracking-normal ${live ? up ? "bg-bull text-bull-foreground" : "bg-bear text-bear-foreground" : "bg-surface-raised text-muted-foreground"}`}>{live ? `${up ? "+" : ""}${quote.changePercent.toFixed(2)}%` : "-"}</Link>
          </div>;
        })}
      </div>
      {rows.length > limit && <Button variant="ghost" className="mt-2 w-full text-muted-foreground" onClick={() => setLimit(value => value + 12)}>Show more</Button>}
    </section>;
}