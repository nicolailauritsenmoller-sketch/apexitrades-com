import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { formatMoney, formatPrice, INSTRUMENT_MAP } from "@/lib/instruments";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildHistory, sortHistory, summarizeHistory, type HistoryEntry, type HistorySort } from "@/lib/trade-history";
import type { PositionRow } from "@/components/PositionsTable";
import type { ContractRow } from "@/lib/contracts.functions";

export { buildHistory } from "@/lib/trade-history";
export type { HistoryEntry } from "@/lib/trade-history";
const PAGE = 20;
const MASK = "••••";

function durationLabel(openedAt: string, closedAt: string) {
  const seconds = Math.max(0, Math.round((Date.parse(closedAt) - Date.parse(openedAt)) / 1000));
  if (!Number.isFinite(seconds)) return "Not recorded";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function executionDate(date: string) {
  return new Date(date).toLocaleString("en-GB", {
    month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC", hour12: false,
  });
}

function signedMoney(value: number, currency: string) {
  return `${value > 0 ? "+" : ""}${formatMoney(value, currency)}`;
}
function pnlTone(value: number | null) {
  return value == null || value === 0 ? "text-muted-foreground" : value > 0 ? "text-bull" : "text-bear";
}

export function TradeHistoryList({ positions, contracts, isLoading, hidden = false }: {
  positions: PositionRow[]; contracts: ContractRow[]; isLoading?: boolean; hidden?: boolean;
}) {
  const all = useMemo(() => buildHistory(positions, contracts), [positions, contracts]);
  const [kind, setKind] = useState<"all" | "contract" | "position">("all");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<HistorySort>("newest");
  const [limit, setLimit] = useState(PAGE);
  const [active, setActive] = useState<string | null>(null);
  const entries = useMemo(() => {
    const term = q.trim().toLowerCase();
    const start = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
    const end = to ? Date.parse(`${to}T23:59:59.999Z`) : Infinity;
    return sortHistory(all.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (term && ![e.symbol, e.displaySymbol, e.reference, e.id].some((v) => v.toLowerCase().includes(term))) return false;
      const date = Date.parse(e.closedAt);
      return date >= start && date <= end;
    }), sort);
  }, [all, kind, q, from, to, sort]);
  const stats = useMemo(() => summarizeHistory(entries), [entries]);
  useEffect(() => { setLimit(PAGE); setActive(null); }, [kind, q, from, to, sort]);
  const tabs = [{ id: "all", label: "All trades" }, { id: "position", label: "Margin" }, { id: "contract", label: "Scalp" }] as const;
  const filtered = Boolean(q.trim() || from || to || kind !== "all");
  const th = "whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase text-muted-foreground";

  return (
    <section aria-label="Trade history blotter" className="min-w-0 touch-manipulation">
      <div className="grid grid-cols-2 gap-y-4 border-b border-border bg-surface px-4 py-4 sm:grid-cols-[1fr_1fr_2fr] sm:gap-6">
        <div>
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Completed trades</div>
          <div className="num mt-1 text-xl font-semibold">{isLoading ? "-" : stats.completed.toLocaleString()}</div>
        </div>
        <div className="border-l border-border pl-4 sm:pl-6">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Win rate</div>
          <div className="num mt-1 text-xl font-semibold">{isLoading ? "-" : hidden ? MASK : stats.winRate == null ? "-" : `${stats.winRate.toFixed(1)}%`}</div>
        </div>
        <div className="col-span-2 border-t border-border pt-3 sm:col-span-1 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
          <div className="text-[10px] font-semibold uppercase text-muted-foreground">Aggregate net realized PnL</div>
          <div className="num mt-1 flex flex-wrap gap-x-4 gap-y-1 text-lg font-semibold">
            {isLoading ? "-" : hidden ? MASK : stats.totals.length ? stats.totals.map(([currency, pnl]) => <span key={currency} className={pnlTone(pnl)}>{signedMoney(pnl, currency)}</span>) : <span className="text-muted-foreground">-</span>}
          </div>
          {!isLoading && stats.priced < stats.completed && <span className="text-[10px] text-muted-foreground">{stats.priced} of {stats.completed} trades with recorded net PnL</span>}
        </div>
      </div>

      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1" role="tablist" aria-label="Trade product">
            {tabs.map((tab) => <Button key={tab.id} variant="ghost" size="sm" role="tab" aria-selected={kind === tab.id} onClick={() => setKind(tab.id)} className={`h-9 touch-manipulation px-3 text-xs ${kind === tab.id ? "bg-secondary text-foreground" : "text-muted-foreground"}`}>
              {tab.label}<span className="num text-[10px] text-muted-foreground">{tab.id === "all" ? all.length : all.filter((e) => e.kind === tab.id).length}</span>
            </Button>)}
          </div>
          <Select value={sort} onValueChange={(v) => { if (v === "newest" || v === "oldest" || v === "pnl-high" || v === "pnl-low") setSort(v); }}>
            <SelectTrigger aria-label="Sort trade history" className="h-9 w-[190px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Date: newest first</SelectItem><SelectItem value="oldest">Date: oldest first</SelectItem>
              <SelectItem value="pnl-high">PnL: highest per currency</SelectItem><SelectItem value="pnl-low">PnL: lowest per currency</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Search trade history" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Asset, pair or execution ref" className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring" />
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <input type="date" aria-label="From date (UTC)" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="num h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-[143px]" />
            <span className="text-xs text-muted-foreground">to</span>
            <input type="date" aria-label="To date (UTC)" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="num h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring sm:w-[143px]" />
            {filtered && <Button variant="ghost" size="icon" title="Reset filters" aria-label="Reset history filters" onClick={() => { setKind("all"); setQ(""); setFrom(""); setTo(""); }}><X /></Button>}
          </div>
        </div>
      </div>

      <div className="max-h-[620px] overflow-auto overscroll-x-contain" role="region" aria-label="Execution table" tabIndex={0}>
        <table className="w-full min-w-[1500px] border-collapse text-xs">
          <caption className="sr-only">Completed margin positions and settled scalp contracts. Prices and net PnL use recorded trade data. Dates are UTC.</caption>
          <thead className="sticky top-0 z-10 bg-surface-raised">
            <tr className="border-b border-border">
              <th scope="col" className={th} aria-sort={sort === "newest" ? "descending" : sort === "oldest" ? "ascending" : "none"}>
                <Button variant="ghost" size="sm" onClick={() => setSort(sort === "newest" ? "oldest" : "newest")} className="-ml-3 h-7 text-[10px] uppercase text-muted-foreground">Execution ref (#ORD){sort === "newest" ? <ArrowDown /> : sort === "oldest" ? <ArrowUp /> : <ArrowUpDown />}</Button>
              </th>
              <th scope="col" className={th}>Asset / pair</th><th scope="col" className={th}>Type</th><th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>Venue / routing</th><th scope="col" className={th}>Entry / exit price</th>
              <th scope="col" className={`${th} text-right`}>Notional size</th><th scope="col" className={`${th} text-right`}>Leverage</th>
              <th scope="col" className={`${th} text-right`}>Fees / slippage</th><th scope="col" className={th}>Duration</th>
              <th scope="col" className={`${th} text-right`}>
                <Button variant="ghost" size="sm" onClick={() => setSort(sort === "pnl-high" ? "pnl-low" : "pnl-high")} className="-mr-3 h-7 text-[10px] uppercase text-muted-foreground">Net PnL / %{sort === "pnl-high" ? <ArrowDown /> : sort === "pnl-low" ? <ArrowUp /> : <ArrowUpDown />}</Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground" role="status">Loading executions...</td></tr>
              : entries.length === 0 ? <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">{all.length ? "No trades match these filters." : "No completed trades."}</td></tr>
                : entries.slice(0, limit).map((entry) => <HistoryRow key={entry.key} entry={entry} hidden={hidden} expanded={active === entry.key} onToggle={() => setActive(active === entry.key ? null : entry.key)} />)}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 text-[10px] text-muted-foreground">
        <span className="num">{isLoading ? "-" : `${Math.min(limit, entries.length)} / ${entries.length}`} executions · UTC</span>
        <span>Net of recorded fees · ROI on margin / stake</span>
        {entries.length > limit && <Button variant="secondary" size="sm" onClick={() => setLimit((n) => n + PAGE)}>Load more</Button>}
      </div>
    </section>
  );
}

function HistoryRow({ entry: e, hidden, expanded, onToggle }: { entry: HistoryEntry; hidden: boolean; expanded: boolean; onToggle: () => void }) {
  const cell = "whitespace-nowrap px-4 py-3.5 align-middle";
  const unavailable = <span className="text-muted-foreground">Not recorded</span>;
  return <>
    <tr className="border-b border-border/70 bg-background even:bg-muted/20 hover:bg-secondary/40 focus-within:bg-secondary/40">
      <td className={cell}>
        <Button variant="ghost" size="sm" aria-expanded={expanded} aria-label={`Details for ${e.reference}`} title={`Record ${e.id}`} onClick={onToggle} className="num -ml-3 h-7 text-[11px] font-semibold">{expanded ? <ChevronDown /> : <ChevronRight />}{e.reference}</Button>
        <div className="num mt-1 text-[10px] text-muted-foreground">{executionDate(e.closedAt)}</div>
      </td>
      <td className={cell}><div className="flex items-center gap-2.5"><AssetIcon symbol={e.symbol} size={28} /><div><div className="font-semibold">{e.displaySymbol}</div><div className="mt-1 max-w-[165px] truncate text-[10px] text-muted-foreground" title={INSTRUMENT_MAP[e.symbol]?.name}>{INSTRUMENT_MAP[e.symbol]?.name ?? e.symbol}</div></div></div></td>
      <td className={cell}><span className={`font-semibold ${e.isLong ? "text-bull" : "text-bear"}`}>{e.isLong ? "Buy / Long" : "Sell / Short"}</span><div className="mt-1 text-[10px] text-muted-foreground">{e.kind === "position" ? "Margin position" : "Scalp contract"}</div></td>
      <td className={cell}><span className="inline-flex items-center gap-1.5 rounded border border-border bg-secondary/40 px-2 py-1 text-[10px] font-medium"><span className="size-1.5 rounded-full bg-bull" />{e.kind === "position" ? "Closed" : "Settled"}</span></td>
      <td className={cell}>{unavailable}<div className="mt-1 text-[10px] text-muted-foreground">{e.kind === "contract" ? "Expiry settlement" : "Routing not recorded"}</div></td>
      <td className={`${cell} num`}><div>{hidden ? MASK : formatPrice(e.entryPrice, e.symbol)}</div><div className="mt-1 text-muted-foreground">{hidden ? MASK : formatPrice(e.exitPrice, e.symbol)}</div></td>
      <td className={`${cell} num text-right`} title={e.kind === "contract" ? "Contract stake is not underlying traded notional" : "Entry price multiplied by quantity"}>{hidden ? MASK : e.notional == null ? "N/A" : formatMoney(e.notional, e.currency)}<div className="mt-1 text-[10px] text-muted-foreground">{e.stake != null ? hidden ? MASK : `${formatMoney(e.stake, e.currency)} stake` : "Entry notional"}</div></td>
      <td className={`${cell} num text-right`}>{e.leverage}x</td>
      <td className={`${cell} num text-right`}><div>{hidden ? MASK : e.fees == null ? unavailable : formatMoney(e.fees, e.currency)}</div><div className="mt-1 text-[10px] text-muted-foreground">Slippage: not recorded</div></td>
      <td className={`${cell} num`}>{durationLabel(e.openedAt, e.closedAt)}<div className="mt-1 text-[10px] text-muted-foreground">Holding time</div></td>
      <td className={`${cell} num text-right ${pnlTone(e.pnl)}`}><div className="font-semibold">{hidden ? MASK : e.pnl == null ? unavailable : signedMoney(e.pnl, e.currency)}</div><div className="mt-1 text-[11px]">{hidden ? MASK : e.pnlPct == null ? "-" : `${e.pnlPct > 0 ? "+" : ""}${e.pnlPct.toFixed(2)}%`}</div></td>
    </tr>
    {expanded && <tr className="border-b border-border bg-secondary/30"><td colSpan={11} className="px-6 py-4"><dl className="flex flex-wrap gap-x-8 gap-y-3 text-xs">
      <div><dt className="text-[10px] uppercase text-muted-foreground">Record ID</dt><dd className="num mt-1">{e.id}</dd></div>
      <div><dt className="text-[10px] uppercase text-muted-foreground">Opened (UTC)</dt><dd className="num mt-1">{executionDate(e.openedAt)}</dd></div>
      <div><dt className="text-[10px] uppercase text-muted-foreground">Closed (UTC)</dt><dd className="num mt-1">{executionDate(e.closedAt)}</dd></div>
      <div><dt className="text-[10px] uppercase text-muted-foreground">Settlement currency</dt><dd className="mt-1">{e.currency}</dd></div>
      <div><dt className="text-[10px] uppercase text-muted-foreground">Return basis</dt><dd className="mt-1">{e.kind === "position" ? "Initial margin" : "Contract stake"}</dd></div>
    </dl></td></tr>}
  </>;
}
