import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Activity } from "lucide-react";
import { getSmartMoney, type FlowTrend } from "@/lib/smart-money.functions";

const usd = (v: number, sign = false) => {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0);
  return `${v < 0 ? "-" : sign ? "+" : ""}$${s}`;
};
const price = (v: number) => v.toLocaleString("en-US", { maximumFractionDigits: v >= 100 ? 2 : v >= 1 ? 4 : 6 });
const time = (t: number) => new Date(t).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "UTC" }) + " UTC";
const trendClass = (t: FlowTrend) => t.includes("Accumulation") ? "text-bull bg-bull/10" : t.includes("Distribution") ? "text-bear bg-bear/10" : "text-muted-foreground bg-muted";

export function SmartMoneyPanel() {
  const fetchFn = useServerFn(getSmartMoney);
  const q = useQuery({ queryKey: ["smart-money"], queryFn: () => fetchFn(), refetchInterval: 15_000 });
  if (q.isPending) return <p className="py-5 text-sm text-muted-foreground">Loading institutional flow...</p>;
  const d = q.data;
  if (!d) return <p className="py-5 text-sm text-muted-foreground">Institutional flow data is unavailable right now.</p>;
  const t = d.totals;
  const cards = [
    { label: "24h Net Institutional Inflow", value: usd(t.netFlowUsd, true), tone: t.netFlowUsd >= 0 ? "text-bull" : "text-bear", note: "Taker buy minus sell volume" },
    { label: "Whale Accumulation Index", value: `${t.accumulationIndex}/100`, tone: t.accumulationIndex >= 55 ? "text-bull" : t.accumulationIndex <= 45 ? "text-bear" : "", note: "50 = balanced flow" },
    { label: "Large Block Volume (>$1M)", value: usd(t.blockVolumeUsd), tone: "", note: "Latest trade sample" },
    { label: "Smart Money Dominance %", value: `${t.dominancePct.toFixed(1)}%`, tone: "", note: "Whale-size prints vs sample" },
  ];
  return <div className="space-y-5">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {cards.map(c => <div key={c.label} className="rounded-xl border border-border bg-card p-3 touch-manipulation">
        <p className="text-[11px] leading-tight text-muted-foreground">{c.label}</p>
        <p className={`mt-1.5 font-mono text-base font-semibold ${c.tone}`}>{c.value}</p>
        <p className="mt-1 text-[10px] text-muted-foreground">{c.note}</p>
      </div>)}
    </div>
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="bg-muted/40 text-[11px] text-muted-foreground"><tr className="text-left">
          <th className="px-3 py-2 font-medium">Asset / Token</th><th className="px-3 py-2 text-right font-medium">24h Net Inflows / Outflows</th>
          <th className="px-3 py-2 font-medium">Whale Accumulation Trend</th><th className="px-3 py-2 text-right font-medium">Large Transactions</th>
          <th className="px-3 py-2 text-right font-medium">Avg. Whale Entry</th><th className="px-3 py-2 text-right font-medium">Last Activity</th>
        </tr></thead>
        <tbody>{d.rows.map(r => <tr key={r.asset} className="border-t border-border">
          <td className="px-3 py-2.5"><span className="font-semibold">{r.asset}</span><span className="ml-1.5 font-mono text-muted-foreground">${price(r.price)}</span></td>
          <td className={`px-3 py-2.5 text-right font-mono ${r.netFlowUsd >= 0 ? "text-bull" : "text-bear"}`}>{usd(r.netFlowUsd, true)}</td>
          <td className="px-3 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${trendClass(r.trend)}`}>{r.trend}</span></td>
          <td className="px-3 py-2.5 text-right font-mono">{r.largeCount ? <>{usd(r.largeVolumeUsd)} ({r.largeCount})<span className="block text-[10px] text-muted-foreground">{usd(r.thresholdUsd)}+ prints</span></> : "-"}</td>
          <td className="px-3 py-2.5 text-right font-mono">{r.whaleEntry ? `$${price(r.whaleEntry)}` : "-"}</td>
          <td className="px-3 py-2.5 text-right font-mono text-muted-foreground">{r.lastActivity ? time(r.lastActivity) : "-"}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Activity className="size-4" />Whale activity <span className="ml-auto flex items-center gap-1 text-[10px] font-normal text-muted-foreground"><span className="size-1.5 animate-pulse rounded-full bg-bull" />Live - {time(d.generatedAt)}</span></h3>
      {d.feed.length ? <ul className="divide-y divide-border rounded-xl border border-border">{d.feed.map(p => <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 text-xs">
        <span className={`w-20 shrink-0 rounded-full px-2 py-0.5 text-center text-[10px] font-semibold ${p.side === "buy" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"}`}>{p.side === "buy" ? "Block buy" : "Block sell"}</span>
        <span className="min-w-0 flex-1"><span className="font-semibold">{usd(p.usd)} {p.asset}</span><span className="text-muted-foreground"> at ${price(p.price)}</span></span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{time(p.time)}</span>
      </li>)}</ul> : <p className="py-4 text-xs text-muted-foreground">No whale-size prints in the latest sample.</p>}
    </div>
  </div>;
}
