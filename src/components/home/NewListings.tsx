import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingLogo } from "./ListingLogo";
import { INSTRUMENT_MAP } from "@/lib/instruments";
import { compactUsd } from "@/lib/home-markets";
import { getNewListings } from "@/lib/new-listings.functions";
import { listingAction } from "@/lib/listing-actions";
import type { RecentListing } from "@/lib/new-listings";
import { ListingPreview } from "./ListingPreview";

const columns = "grid grid-cols-[minmax(0,1fr)_85px_70px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_90px_70px_80px_85px_120px]";
const priceLabel = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: value < 1 ? 8 : 4 });

export function NewListings({ search }: { search: string }) {
  const [selected, setSelected] = useState<RecentListing | null>(null);
  const fetchListings = useServerFn(getNewListings);
  const feed = useQuery({ queryKey: ["recent-spot-listings"], queryFn: () => fetchListings(), refetchInterval: 30_000, retry: 3, placeholderData: prev => prev, staleTime: 20_000 });
  const term = search.trim().toLowerCase();
  const rows = (feed.data?.rows ?? []).filter(row => `${row.name} ${row.symbol}`.toLowerCase().includes(term));
  return <div role="tabpanel" aria-label="New Crypto markets">
    <div className="flex items-center justify-between gap-2 px-2 py-2 text-[10px] text-muted-foreground"><span>{feed.isFetching ? "Updating..." : feed.data ? `Updated ${new Date(feed.data.asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}</span></div>
    <div className={`${columns} px-2 py-2 text-[11px] text-muted-foreground`}><span>Name</span><span className="text-right">Last Price</span><span className="text-right">24h chg%</span><span className="hidden text-right sm:block">24h Vol</span><span className="hidden text-right sm:block">Market Cap</span><span className="hidden text-right sm:block">Actions</span></div>
    {feed.isPending && <p className="py-10 text-center text-sm text-muted-foreground">Loading recent listings...</p>}
    {(feed.isError || feed.data?.unavailable) && !rows.length && <p role="status" className="px-2 py-3 text-xs text-muted-foreground">Live listing data temporarily unavailable. Retrying automatically.</p>}
    {!feed.isPending && !feed.isError && !feed.data?.unavailable && !rows.length && <p className="py-10 text-center text-sm text-muted-foreground">{term ? "No matching recent listings." : "No new spot-token announcements in the past 90 days."}</p>}
    {rows.map(row => {
      const supported = Boolean(INSTRUMENT_MAP[row.symbol]);
      const actions = <>
        {row.status === "listed" ? <>
          <Button variant="ghost" size="icon" className="size-10 text-muted-foreground" onClick={() => setSelected(row)} aria-label={`View ${row.ticker} chart`} title={`View ${row.ticker} chart`}><ChartNoAxesCombined /></Button>
          {listingAction(row.status, supported) === "terminal" ? <Button size="sm" className="h-10 px-2" asChild><Link to="/terminal/$symbol" params={{ symbol: row.symbol }}>Trade</Link></Button> : <Button size="sm" className="h-10 px-2" onClick={() => setSelected(row)}>Trade</Button>}
        </> : <Button variant="outline" size="sm" className="h-10 px-2" onClick={() => setSelected(row)}>Details</Button>}
      </>;
      return <div key={row.symbol} className={`${columns} border-t border-border/50 px-2 py-3`}>
        <div className="flex min-w-0 items-center gap-2"><ListingLogo ticker={row.ticker} name={row.name} logoUrl={row.logoUrl} /><div className="min-w-0"><span className="block truncate text-[13px] font-semibold">{row.ticker}</span><span className="block truncate text-[11px] text-muted-foreground">{row.name}</span><span className="block text-[10px] text-muted-foreground">{row.status === "listed" ? "Live · Announced" : "Announced"} {new Date(row.announcedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</span></div></div>
        <span className="num text-right text-[13px]">{row.price !== null ? priceLabel(row.price) : "-"}<span className="block text-[10px] text-muted-foreground">USDT</span></span>
        <span className={`num text-right text-xs font-semibold ${row.changePercent === null ? "text-muted-foreground" : row.changePercent >= 0 ? "text-bull" : "text-bear"}`}>{row.changePercent !== null ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(2)}%` : "-"}</span>
        <span className="num hidden text-right text-xs sm:block" title="24-hour quote volume in USDT">{compactUsd(row.volume)}</span>
        <span className="num hidden text-right text-xs text-muted-foreground sm:block" title={row.marketCap === null ? "Market capitalization not reported by the provider" : "Market capitalization in USD"}>{compactUsd(row.marketCap)}</span>
        <div className="hidden items-center justify-end sm:flex">{actions}</div>
        <div className="col-span-3 flex items-center justify-between gap-2 sm:hidden"><div className="text-[10px] text-muted-foreground">Vol {compactUsd(row.volume)} USDT · Cap {compactUsd(row.marketCap)}</div><div className="flex shrink-0 items-center">{actions}</div></div>
      </div>;
    })}
    <ListingPreview listing={selected ? feed.data?.rows.find(row => row.symbol === selected.symbol) ?? selected : null} onClose={() => setSelected(null)} />
  </div>;
}