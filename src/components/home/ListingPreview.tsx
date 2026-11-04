import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CandleChart } from "@/components/CandleChart";
import { INSTRUMENT_MAP } from "@/lib/instruments";
import { compactUsd } from "@/lib/home-markets";
import { listingAction } from "@/lib/listing-actions";
import type { RecentListing } from "@/lib/new-listings";
import type { Candle } from "@/lib/market-types";
import { ListingLogo } from "./ListingLogo";

function PreviewContent({ listing }: { listing: RecentListing }) {
  const [interval, setInterval] = useState("1h");
  const candles = useQuery({
    queryKey: ["listing-preview-candles", listing.symbol, interval],
    enabled: listing.status === "listed",
    staleTime: 20_000,
    refetchInterval: 30_000,
    queryFn: async ({ signal }): Promise<Candle[]> => {
      const response = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${encodeURIComponent(listing.symbol)}&interval=${interval}&limit=80`, { signal });
      if (!response.ok) throw new Error("Chart data unavailable");
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Invalid chart data");
      return data.flatMap((row: unknown) => {
        if (!Array.isArray(row)) return [];
        const [t, o, h, l, c, v] = row.slice(0, 6).map(Number);
        return [t, o, h, l, c, v].every(Number.isFinite) && t > 0 && Math.min(o, h, l, c) > 0 && h >= Math.max(o, c, l) && l <= Math.min(o, c) && v >= 0 ? [{ t, o, h, l, c, v }] : [];
      });
    },
  });
  const tradable = listingAction(listing.status, Boolean(INSTRUMENT_MAP[listing.symbol])) === "terminal";
  return <>
    <DialogHeader>
      <div className="flex items-center gap-3 pr-6"><ListingLogo ticker={listing.ticker} name={listing.name} logoUrl={listing.logoUrl} /><DialogTitle>{listing.ticker} / USDT</DialogTitle></div>
      <DialogDescription>{listing.name} · {listing.status === "listed" ? "Spot market" : "Upcoming listing"}</DialogDescription>
    </DialogHeader>
    <dl className="grid grid-cols-2 gap-3 border-y border-border py-3 sm:grid-cols-4">
      <div><dt className="text-xs text-muted-foreground">Last Price (USDT)</dt><dd className="num text-sm">{listing.price?.toLocaleString("en-US", { maximumFractionDigits: 8 }) ?? "-"}</dd></div>
      <div><dt className="text-xs text-muted-foreground">24h Change</dt><dd className={`num text-sm ${listing.changePercent === null ? "text-muted-foreground" : listing.changePercent >= 0 ? "text-bull" : "text-bear"}`}>{listing.changePercent === null ? "-" : `${listing.changePercent >= 0 ? "+" : ""}${listing.changePercent.toFixed(2)}%`}</dd></div>
      <div><dt className="text-xs text-muted-foreground">24h Vol (USDT)</dt><dd className="num text-sm">{compactUsd(listing.volume)}</dd></div>
      <div><dt className="text-xs text-muted-foreground">Market Cap</dt><dd className="num text-sm">{compactUsd(listing.marketCap)}</dd></div>
    </dl>
    {listing.status === "listed" ? <>
      <div className="flex gap-2" aria-label="Chart interval">{["15m", "1h", "4h", "1d"].map(value => <Button key={value} size="sm" variant={interval === value ? "secondary" : "ghost"} aria-pressed={interval === value} onClick={() => setInterval(value)}>{value}</Button>)}</div>
      {candles.isPending ? <div className="grid h-72 place-items-center text-sm text-muted-foreground">Loading live chart...</div> : candles.isError || !candles.data?.length ? <div role="status" className="grid h-72 place-items-center text-sm text-muted-foreground">Live chart temporarily unavailable.</div> : <CandleChart candles={candles.data} symbol={listing.symbol} height={288} />}
    </> : <p role="status" className="py-8 text-center text-sm text-muted-foreground">Trading and chart data are not yet available for this announced market.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
      <p className="text-xs text-muted-foreground">Announced {new Date(listing.announcedAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</p>
      {tradable ? <Button asChild><Link to="/terminal/$symbol" params={{ symbol: listing.symbol }}>Open Trading Terminal</Link></Button> : <p role="status" className="text-xs text-muted-foreground">Not available for order execution on Velocity Trade.</p>}
    </div>
  </>;
}

export function ListingPreview({ listing, onClose }: { listing: RecentListing | null; onClose: () => void }) {
  return <Dialog open={Boolean(listing)} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
      {listing && <PreviewContent key={listing.symbol} listing={listing} />}
    </DialogContent>
  </Dialog>;
}