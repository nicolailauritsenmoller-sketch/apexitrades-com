import { Flame, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuotes } from "@/hooks/useMarket";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT", "ARBUSDT"];

export function ExchangeSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { list } = useQuotes(SYMBOLS, 5000);
  const trending = list.filter(q => !q.stale && q.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent)[0];
  return <div className="exchange-search relative flex min-h-11 items-center gap-2 rounded-lg bg-surface-raised px-3">
    <Search className="size-4 shrink-0 text-muted-foreground" />
    <input aria-label="Search homepage markets" value={value} onChange={e => onChange(e.target.value)} placeholder={trending ? "" : "Search coins, futures and stocks"} className="relative z-10 min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground" />
    {!value && trending && <span className="pointer-events-none absolute inset-y-0 left-9 flex items-center gap-1.5 text-sm text-muted-foreground"><Flame className="size-4 text-warning" />{trending.symbol.replace("USDT", "")} top gainer</span>}
    {value && <Button variant="ghost" size="icon" aria-label="Clear market search" onClick={() => onChange("")}><X /></Button>}
  </div>;
}