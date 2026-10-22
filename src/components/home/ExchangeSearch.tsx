import { Flame, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuotes } from "@/hooks/useMarket";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ARBUSDT"];

export function ExchangeSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { list } = useQuotes(SYMBOLS, 5000);
  const trending = list.filter(q => !q.stale && q.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent)[0];
  return <div className="exchange-search flex h-11 items-center gap-2 rounded-lg bg-surface-raised px-3 focus-within:ring-1 focus-within:ring-ring">
    <Search className="size-4 shrink-0 text-muted-foreground" />
     {!value && trending && <Flame className="size-4 shrink-0 fill-market-flame/20 text-market-flame" aria-label="Trending asset" />}
     <input aria-label="Search homepage markets" value={value} onChange={e => onChange(e.target.value)} placeholder={trending ? `${trending.symbol.replace("USDT", "")} top gainer` : "Search coins, futures and stocks"} className="min-w-0 flex-1 bg-transparent py-2.5 text-[13px] font-medium leading-5 outline-none placeholder:text-muted-foreground" />
    {value && <Button variant="ghost" size="icon" aria-label="Clear market search" onClick={() => onChange("")}><X /></Button>}
  </div>;
}