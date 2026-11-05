import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Info, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { currentSampleBucket, filterSampleLeadTraders, sampleLeadTraders } from "@/lib/sample-lead-traders";

const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : `$${(n / 1e3).toFixed(1)}K`);

export function SampleLeadTraderDirectory() {
  const [bucket, setBucket] = useState(0);
  useEffect(() => {
    setBucket(currentSampleBucket());
    const id = setInterval(() => setBucket(currentSampleBucket()), 30_000);
    return () => clearInterval(id);
  }, []);
  const all = useMemo(() => sampleLeadTraders(bucket), [bucket]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const view = filterSampleLeadTraders(all, query, page);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Search sample traders or style" className="pl-9" aria-label="Search sample traders" />
        <Info className="pointer-events-auto absolute right-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/50" aria-label="Sample data, not real traders" title="Sample data, not real traders" />
      </div>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-xs">
          <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-2 py-2 text-left font-medium">Trader</th>
              <th className="px-2 py-2 text-right font-medium">30D ROI</th>
              <th className="px-2 py-2 text-right font-medium">Sharpe</th>
              <th className="px-2 py-2 text-right font-medium">Volume</th>
              <th className="px-2 py-2 text-right font-medium">Followers</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono tabular-nums">
            {view.rows.map(r => (
              <tr key={r.id}>
                <td className="px-2 py-2 font-sans"><div className="font-medium">{r.handle}</div><div className="text-[10px] text-muted-foreground">{r.style}</div></td>
                <td className={`px-2 py-2 text-right ${r.roiPct >= 0 ? "text-bull" : "text-bear"}`}>{r.roiPct >= 0 ? "+" : ""}{r.roiPct.toFixed(2)}%</td>
                <td className="px-2 py-2 text-right">{r.sharpe.toFixed(2)}</td>
                <td className="px-2 py-2 text-right">{usd(r.managedVolume)}</td>
                <td className="px-2 py-2 text-right">{r.followers.toLocaleString()}</td>
              </tr>
            ))}
            {view.rows.length === 0 && <tr><td colSpan={5} className="px-2 py-6 text-center font-sans text-muted-foreground">No matching sample traders</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span />
        <div className="flex items-center gap-2">
          <Button type="button" size="icon" variant="outline" className="size-8" disabled={view.page <= 1} onClick={() => setPage(view.page - 1)} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
          <span className="font-mono">{view.page} / {view.pages}</span>
          <Button type="button" size="icon" variant="outline" className="size-8" disabled={view.page >= view.pages} onClick={() => setPage(view.page + 1)} aria-label="Next page"><ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
