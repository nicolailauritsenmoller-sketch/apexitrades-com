import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Search, Zap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { getTradesDesk, bulkSettleContracts } from "@/lib/trades-desk.functions";

type TypeFilter = "all" | "contract" | "margin" | "scalp";
type OutcomeFilter = "all" | "win" | "loss" | "open" | "forced";
const ASSETS = ["all", "BTC", "ETH", "SOL", "forex", "other"] as const;

const fmt = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(n) ? "-" : n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
const px = (n: number | null | undefined) => (n == null ? "-" : fmt(n, n >= 100 ? 2 : n >= 1 ? 4 : 6));
const ts = (s?: string | null) => (s ? new Date(s).toLocaleString() : "-");
const modeLabel = (m?: string) => (m === "force_win" ? "Force Win" : m === "force_loss" ? "Force Loss" : "Normal");

function baseAsset(r: any) {
  const s = String(r.displaySymbol ?? r.symbol).toUpperCase();
  return s.split(/[\/\-]/)[0];
}
function isForex(r: any) {
  return r.assetClass === "forex" || /^(EUR|GBP|USD|JPY|AUD|CAD|CHF|NZD)[\/]?(USD|EUR|JPY|GBP|CHF|CAD)$/.test(String(r.displaySymbol ?? "").toUpperCase());
}
function isForced(r: any) {
  return (r.override && r.override !== "normal") || r.audit?.some((a: any) => a.action === "trade.forced_settlement" || a.action === "trade.outcome.contract_override");
}
function typeLabel(r: any) {
  if (r.kind === "position") return r.leverage > 1 ? "Margin" : "Spot";
  return r.durationSeconds <= 300 ? "Scalp" : "Digital contract";
}

export function TradesDesk({ canSettle }: { canSettle: boolean }) {
  const fetchDesk = useServerFn(getTradesDesk);
  const settle = useServerFn(bulkSettleContracts);
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState<TypeFilter>("all");
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("all");
  const [outcome, setOutcome] = useState<OutcomeFilter>("all");
  const [q, setQ] = useState("");
  const [inspect, setInspect] = useState<any | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);

  const desk = useQuery({
    queryKey: ["trades-desk", from, to],
    queryFn: () => fetchDesk({ data: { from, to: `${to}T23:59:59` } }),
    refetchInterval: 10_000,
  });
  const accounts = (desk.data?.accounts ?? {}) as Record<string, any>;

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    return ((desk.data?.rows ?? []) as any[]).filter((r) => {
      if (type === "contract" && !(r.kind === "contract" && r.durationSeconds > 300)) return false;
      if (type === "scalp" && !(r.kind === "contract" && r.durationSeconds <= 300)) return false;
      if (type === "margin" && !(r.kind === "position")) return false;
      if (asset !== "all") {
        const b = baseAsset(r);
        if (asset === "forex" ? !isForex(r) : asset === "other" ? ["BTC", "ETH", "SOL"].includes(b) || isForex(r) : b !== asset) return false;
      }
      if (outcome === "open" && r.status !== "open") return false;
      if (outcome === "win" && !(r.status !== "open" && r.result === "win")) return false;
      if (outcome === "loss" && !(r.status !== "open" && r.result === "loss")) return false;
      if (outcome === "forced" && !isForced(r)) return false;
      if (term) {
        const a = accounts[r.userId] ?? {};
        const hay = [r.id, r.id.slice(0, 8), a.uid, a.name, a.email, r.userId, r.displaySymbol].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [desk.data, type, asset, outcome, q, accounts]);

  const openContracts = rows.filter((r) => r.kind === "contract" && r.status === "open");
  const history = rows.filter((r) => !(r.kind === "contract" && r.status === "open"));
  const stats = useMemo(() => {
    const settled = rows.filter((r) => r.status !== "open");
    const wins = settled.filter((r) => r.result === "win").length;
    return {
      total: rows.length,
      open: rows.filter((r) => r.status === "open").length,
      winRate: settled.length ? (wins / settled.length) * 100 : 0,
      net: settled.reduce((s, r) => s + (r.net ?? 0), 0),
      fees: rows.reduce((s, r) => s + (r.fee ?? 0), 0),
      forced: rows.filter(isForced).length,
    };
  }, [rows]);

  const bulk = useMutation({
    mutationFn: (reason: string) => settle({ data: { ids: [...selected], reason } }),
    onSuccess: (r) => {
      toast.success(`Settled ${r.settled} contract(s)${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} already closed` : ""}.`);
      setSelected(new Set());
      void desk.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function exportCsv() {
    const head = ["trade_id", "type", "trader_uid", "trader_name", "symbol", "side", "status", "result", "stake", "currency", "leverage", "entry_price", "exit_price", "fee", "payout", "net_pnl", "outcome_override", "opened_at", "closed_at"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((r) => {
      const a = accounts[r.userId] ?? {};
      return [r.id, typeLabel(r), a.uid, a.name, r.displaySymbol, r.side, r.status, r.result, r.stake, r.currency, r.leverage, r.entry, r.exit, r.fee, r.payout, r.net, r.override, r.openedAt, r.closedAt].map(esc).join(",");
    });
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url;
    el.download = `trades-${from}-to-${to}.csv`;
    el.click();
    URL.revokeObjectURL(url);
  }

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sel = "h-9 rounded-md border border-border bg-background px-2 text-sm";

  return (
    <div className="space-y-4" style={{ touchAction: "manipulation" }}>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {[
          ["Trades in view", String(stats.total)],
          ["Open", String(stats.open)],
          ["Win rate", `${fmt(stats.winRate, 1)}%`],
          ["Net trader P/L", fmt(stats.net)],
          ["Fees collected", fmt(stats.fees)],
          ["Forced / overridden", String(stats.forced)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted-foreground">Trade type<br />
            <select className={sel} value={type} onChange={(e) => setType(e.target.value as TypeFilter)}>
              <option value="all">All</option><option value="contract">Options / Digital contracts</option>
              <option value="margin">Margin leverage positions</option><option value="scalp">Scalp trades</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Asset / pair<br />
            <select className={sel} value={asset} onChange={(e) => setAsset(e.target.value as any)}>
              <option value="all">All</option><option value="BTC">BTC/USDT</option><option value="ETH">ETH/USDT</option>
              <option value="SOL">SOL/USDT</option><option value="forex">Forex</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Outcome<br />
            <select className={sel} value={outcome} onChange={(e) => setOutcome(e.target.value as OutcomeFilter)}>
              <option value="all">All</option><option value="win">Settled win</option><option value="loss">Settled loss</option>
              <option value="open">Pending / open</option><option value="forced">Forced outcome</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">From<br /><input type="date" className={sel} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="text-xs text-muted-foreground">To<br /><input type="date" className={sel} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Trade ID, UID, trader name or position ref" className={`${sel} w-full pl-8`} />
          </div>
          <Button variant="outline" size="sm" onClick={() => void desk.refetch()} disabled={desk.isFetching}><RefreshCw className={`size-4 ${desk.isFetching ? "animate-spin" : ""}`} /></Button>
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!rows.length}><Download className="size-4" /> Export filtered trades (CSV)</Button>
        </div>
        {desk.data?.capped && <p className="mt-2 text-[11px] text-muted-foreground">Showing the most recent 1,500 records per type - narrow the date range for older trades.</p>}
        {desk.error && <p className="mt-2 text-xs text-destructive">{(desk.error as Error).message}</p>}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <h3 className="text-sm font-semibold">Open contracts ({openContracts.length})</h3>
          {canSettle && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(openContracts.map((r) => r.id)))} disabled={!openContracts.length}>Select all</Button>
              <Button variant="destructive" size="sm" disabled={!selected.size || bulk.isPending} onClick={() => setConfirm(true)}>
                <Zap className="size-4" /> Bulk settle open contracts ({selected.size})
              </Button>
            </div>
          )}
        </div>
        <TradeTable rows={openContracts} accounts={accounts} onOpen={setInspect} selectable={canSettle} selected={selected} onToggle={toggle} empty="No open contracts match these filters." />
      </div>

      <div className="rounded-lg border border-border bg-card">
        <h3 className="border-b border-border p-3 text-sm font-semibold">Recent trades ({history.length})</h3>
        <TradeTable rows={history.slice(0, 400)} accounts={accounts} onOpen={setInspect} empty="No trades match these filters." />
      </div>

      <AdminActionConfirm
        open={confirm}
        title={`Force-settle ${selected.size} open contract(s)?`}
        description="Each selected contract settles immediately at the current mark price, applying any active outcome override, and payouts are credited. This cannot be undone and is recorded in the audit log."
        pending={bulk.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={(reason) => bulk.mutateAsync(reason)}
      />

      <Sheet open={!!inspect} onOpenChange={(v) => !v && setInspect(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {inspect && <Inspector r={inspect} a={accounts[inspect.userId] ?? {}} spreadPct={desk.data?.spreadPct ?? 0} globalOutcome={desk.data?.globalOutcome ?? "normal"} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function TradeTable({ rows, accounts, onOpen, selectable, selected, onToggle, empty }: {
  rows: any[]; accounts: Record<string, any>; onOpen: (r: any) => void; selectable?: boolean;
  selected?: Set<string>; onToggle?: (id: string) => void; empty: string;
}) {
  if (!rows.length) return <p className="p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
          <tr className="border-b border-border">
            {selectable && <th className="w-8 p-2" />}
            <th className="p-2">Opened</th><th className="p-2">Trader</th><th className="p-2">Type</th><th className="p-2">Pair</th>
            <th className="p-2 text-right">Stake</th><th className="p-2 text-right">Entry</th><th className="p-2 text-right">Exit</th>
            <th className="p-2">Outcome</th><th className="p-2 text-right">Net P/L</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const a = accounts[r.userId] ?? {};
            return (
              <tr key={r.id} onClick={() => onOpen(r)} className="cursor-pointer border-b border-border/60 hover:bg-secondary/40">
                {selectable && (
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected?.has(r.id)} onChange={() => onToggle?.(r.id)} aria-label="Select contract" />
                  </td>
                )}
                <td className="p-2 font-mono text-xs text-muted-foreground">{ts(r.openedAt)}</td>
                <td className="p-2"><p className="font-medium">{a.name ?? "-"}</p><p className="font-mono text-[11px] text-muted-foreground">#{a.uid ?? r.userId.slice(0, 8)}</p></td>
                <td className="p-2 text-xs">{typeLabel(r)}</td>
                <td className="p-2"><span className="font-semibold">{r.displaySymbol}</span>{" "}<span className={["up", "long"].includes(r.side) ? "text-ops-emerald" : "text-ops-red"}>{String(r.side).toUpperCase()}</span></td>
                <td className="p-2 text-right font-mono tabular-nums">{fmt(r.stake)}</td>
                <td className="p-2 text-right font-mono tabular-nums">{px(r.entry)}</td>
                <td className="p-2 text-right font-mono tabular-nums">{px(r.exit)}</td>
                <td className="p-2 text-xs">
                  {r.status === "open" ? "Open" : r.result === "win" ? <span className="text-ops-emerald">Win</span> : r.result === "loss" ? <span className="text-ops-red">Loss</span> : r.result ?? r.status}
                  {isForced(r) && <span className="ml-1 rounded bg-ops-amber-bg px-1 text-[10px] text-ops-amber">Forced</span>}
                </td>
                <td className={`p-2 text-right font-mono tabular-nums ${(r.net ?? 0) > 0 ? "text-ops-emerald" : (r.net ?? 0) < 0 ? "text-ops-red" : ""}`}>{r.net == null ? "-" : `${r.net > 0 ? "+" : ""}${fmt(r.net)}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-4 py-1 text-sm"><span className="text-muted-foreground">{k}</span><span className="text-right font-mono tabular-nums">{v}</span></div>;
}

function Inspector({ r, a, spreadPct, globalOutcome }: { r: any; a: any; spreadPct: number; globalOutcome: string }) {
  const basePayout = r.kind === "contract" ? r.stake * (1 + r.payoutPct / 100) : null;
  const effective = r.override && r.override !== "normal" ? r.override : a.outcomeMode && a.outcomeMode !== "normal" ? a.outcomeMode : globalOutcome;
  return (
    <div className="space-y-5">
      <div>
        <SheetTitle>{r.displaySymbol} - {typeLabel(r)}</SheetTitle>
        <SheetDescription className="font-mono text-xs">Trade ID {r.id}</SheetDescription>
      </div>
      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Execution breakdown</h4>
        <Row k={r.kind === "contract" ? "Stake amount" : "Margin"} v={`${fmt(r.stake)} ${r.currency}`} />
        {r.notional != null && <Row k="Notional" v={`${fmt(r.notional)} ${r.currency}`} />}
        <Row k="Entry price" v={px(r.entry)} />
        <Row k={r.status === "open" ? "Exit price" : "Mark / exit price"} v={px(r.exit)} />
        <Row k="Price impact" v="Not recorded" />
        <Row k="Applied leverage" v={`${r.leverage}x`} />
        <Row k="Direction" v={String(r.side).toUpperCase()} />
      </section>
      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Fee & payout details</h4>
        {basePayout != null && <Row k={`Base payout (${r.payoutPct}%)`} v={fmt(basePayout)} />}
        <Row k="Fee charged" v={fmt(r.fee, 4)} />
        <Row k="Applied VIP fee discount" v={`${fmt(r.fees?.discountPct ?? 0, 1)}%`} />
        <Row k="Spread markup (platform setting)" v={`${fmt(spreadPct, 3)}%`} />
        <Row k="Final payout" v={r.payout == null ? "-" : fmt(r.payout)} />
        <Row k="Net profit / loss" v={r.net == null ? "-" : <span className={r.net >= 0 ? "text-ops-emerald" : "text-ops-red"}>{r.net > 0 ? "+" : ""}{fmt(r.net)}</span>} />
      </section>
      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Account snapshot</h4>
        <Row k="Trader" v={a.name ?? "-"} />
        <Row k="Trader UID" v={a.uid ? `#${a.uid}` : r.userId.slice(0, 8)} />
        <Row k="VIP tier" v={a.vipLevel ? `Tier ${a.vipLevel}` : a.vipTier ?? "Standard"} />
        <Row k="Account equity (USD-pegged)" v={fmt(a.equityUsd)} />
        <Row k="Account outcome override" v={modeLabel(a.outcomeMode)} />
        <Row k="Contract override" v={modeLabel(r.override)} />
        <Row k="Global default" v={modeLabel(globalOutcome)} />
        {r.kind === "contract" && <Row k="Effective at settlement" v={modeLabel(effective)} />}
      </section>
      <section>
        <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Audit details</h4>
        <Row k="Execution timestamp" v={ts(r.openedAt)} />
        {r.expiresAt && <Row k="Scheduled expiry" v={ts(r.expiresAt)} />}
        <Row k="Closed / settled" v={ts(r.closedAt)} />
        <Row k="IP address (last known)" v={a.ip ?? "-"} />
        <Row k="Device fingerprint (last known)" v={a.device ? <span title={a.device.id}>{a.device.label || String(a.device.id).slice(0, 12)}</span> : "-"} />
        <div className="mt-2 space-y-2">
          <p className="text-xs text-muted-foreground">Manual modifications</p>
          {r.audit?.length ? r.audit.map((e: any) => (
            <div key={e.id} className="rounded-md border border-border p-2 text-xs">
              <p className="font-semibold">{e.action}</p>
              <p className="text-muted-foreground">{ts(e.created_at)} - {e.actor_name ?? "Staff"}{e.details?.staff_id ? ` (${e.details.staff_id})` : ""}{e.details?.ip ? ` - ${e.details.ip}` : ""}</p>
              {e.details?.reason && <p className="mt-1">{e.details.reason}</p>}
              {e.details?.from !== undefined && <p className="mt-1 font-mono">{modeLabel(e.details.from)} {"->"} {modeLabel(e.details.to)}</p>}
            </div>
          )) : <p className="text-xs text-muted-foreground">None recorded.</p>}
        </div>
      </section>
    </div>
  );
}
