import { useEffect, useState } from "react";
import { Flame, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuotes } from "@/hooks/useMarket";
import { INSTRUMENTS } from "@/lib/instruments";

const CATALOG = INSTRUMENTS.filter(i => i.assetClass === "crypto" && i.symbol.endsWith("USDT")).map(i => i.symbol);
const ROTATE_MS = 4000;

export function ExchangeSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { list } = useQuotes(CATALOG, 5000);
  const gainers = list.filter(q => !q.stale && q.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 3);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (gainers.length < 2) return;
    const timer = setInterval(() => setIndex(i => (i + 1) % gainers.length), ROTATE_MS);
    return () => clearInterval(timer);
  }, [gainers.length]);

  const trending = gainers.length > 0 ? gainers[index % gainers.length] : undefined;

  return <div className="exchange-search flex h-11 items-center gap-2 rounded-lg bg-surface-raised px-3 focus-within:ring-1 focus-within:ring-ring">
    <Search className="size-4 shrink-0 text-muted-foreground" />
     {!value && trending && <Flame className="size-4 shrink-0 fill-market-flame/20 text-market-flame" aria-label="Trending asset" />}
     <input aria-label="Search homepage markets" value={value} onChange={e => onChange(e.target.value)} placeholder={trending ? `${trending.symbol.replace(/USDT$/, "")} top gainer` : "Search coins, futures and stocks"} className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-medium leading-5 outline-none placeholder:text-muted-foreground" />
    {value && <Button variant="ghost" size="icon" aria-label="Clear market search" onClick={() => onChange("")}><X /></Button>}
  </div>;
}
