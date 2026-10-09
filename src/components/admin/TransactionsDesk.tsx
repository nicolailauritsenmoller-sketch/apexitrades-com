import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { getLedgerDesk } from "@/lib/ledger-desk.functions";
import { downloadCsv } from "@/lib/csv";

const USD_LIKE = new Set(["USDT", "USDC", "USD", "BUSD", "DAI"]);
const sel = "min-h-9 rounded-md border border-input bg-background px-2 text-xs";

function typeOf(r: any): string {
  if (r.kind.startsWith("deposit")) return "deposit";
  if (r.kind.startsWith("withdrawal")) return "withdrawal";
  if (r.kind.startsWith("swap")) return "swap";
  if (r.kind.includes("fee")) return "fee";
  if (r.ref_table === "contracts" || r.ref_table === "positions") return "trade";
  return "other";
}
const TYPE_LABEL: Record<string, string> = { deposit: "Deposit", withdrawal: "Withdrawal", swap: "Swap", fee: "Fee", trade: "Trade Settlement", other: "Adjustment" };
const STATUS_MAP: Record<string, string> = { approved: "COMPLETED", pending: "PENDING", failed: "FAILED", cancelled: "CANCELLED" };

function explorer(network: string | null, hash: string | null) {
  if (!hash) return null;
  const n = String(network ?? "").toUpperCase();
  if (n.includes("TRC")) return `https://tronscan.org/#/transaction/${hash}`;
  if (n.includes("ERC") || n === "ETH") return `https://etherscan.io/tx/${hash}`;
  if (n.includes("BEP") || n.includes("BSC")) return `https://bscscan.com/tx/${hash}`;
  if (n.includes("BTC") || n.includes("BITCOIN")) return `https://mempool.space/tx/${hash}`;
  if (n.includes("SOL")) return `https://solscan.io/tx/${hash}`;
  return null;
}
const copy = (v: string, l: string) => void navigator.clipboard.writeText(v).then(() => toast.success(`${l} copied.`));
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 8 });
const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function rangeFor(preset: string, from: string, to: string) {
  const now = new Date();
  if (preset === "custom" && from) return { from: new Date(from).toISOString(), to: to ? new Date(`${to}T23:59:59`).toISOString() : now.toISOString() };
  const start = new Date(now);
  if (preset === "today") start.setHours(0, 0, 0, 0);
  else start.setDate(now.getDate() - (preset === "7d" ? 7 : 30));
  return { from: start.toISOString(), to: now.toISOString() };
}

const CSV_COLS = ["id", "tx_hash", "uid", "email", "type", "currency", "amount", "fee", "net", "status", "created_at"];
const csvRows = (rows: any[]) => rows.map((r) => ({ ...r, type: TYPE_LABEL[typeOf(r)] }));

export function TransactionsDesk() {
  const fetch = useServerFn(getLedgerDesk);
  const [preset, setPreset] = useState("7d");
  const [cFrom, setCFrom] = useState("");
  const [cTo, setCTo] = useState("");
  const range = useMemo(() => rangeFor(preset, cFrom, cTo), [preset, cFrom, cTo]);
  const q = useQuery({ queryKey: ["ledger-desk", preset, cFrom, cTo], queryFn: () => fetch({ data: range }), refetchInterval: 15_000 });
  const [type, setType] = useState("all");
  const [asset, setAsset] = useState("all");
  const [status, setStatus] = useState("all");
  const [term, setTerm] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<any>(null);

  const all = (q.data ?? []) as any[];
  const rows = all.filter((r) => {
    if (type !== "all" && (type === "fee" ? !(r.fee > 0 || typeOf(r) === "fee") : typeOf(r) !== type)) return false;
    if (asset !== "all" && r.currency !== asset) return false;
    if (status !== "all" && r.status !== STATUS_MAP[status]) return false;
    const t = term.trim().toLowerCase();
    return !t || [r.tx_hash, r.uid, r.email, r.id, r.ref_id].some((v) => String(v ?? "").toLowerCase().includes(t));
  });

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const done = all.filter((r) => r.status === "COMPLETED" && USD_LIKE.has(r.currency));
  const sum = (f: (r: any) => boolean, v: (r: any) => number = (r) => Math.abs(r.amount)) => done.filter(f).reduce((a, r) => a + v(r), 0);
  const stats = [
    { label: "Total daily volume", v: sum((r) => new Date(r.created_at) >= today) },
    { label: "Total deposits", v: sum((r) => typeOf(r) === "deposit") },
    { label: "Total withdrawals", v: sum((r) => typeOf(r) === "withdrawal") },
    { label: "Platform fee earnings", v: sum(() => true, (r) => r.fee) },
  ];

  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const toggle = (id: string) => setChecked((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="panel p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
            <p className="num mt-1 text-xl font-bold">{usd(s.v)}</p>
          </div>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">Dollar totals cover completed USD-pegged records (USDT, USDC, USD) in the selected date range; other assets are listed in the ledger but not converted.</p>

      <section className="panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search TxID, UID, email or reference" className="min-h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-3 text-xs" />
          <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)} className={sel}>
            <option value="all">All types</option>{["deposit", "withdrawal", "swap", "fee", "trade"].map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <select aria-label="Asset" value={asset} onChange={(e) => setAsset(e.target.value)} className={sel}>
            <option value="all">All assets</option>{["USDT", "BTC", "ETH", "EUR", "GBP"].map((a) => <option key={a}>{a}</option>)}
          </select>
          <select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
            <option value="all">All statuses</option>{Object.keys(STATUS_MAP).map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </select>
          <select aria-label="Date range" value={preset} onChange={(e) => setPreset(e.target.value)} className={sel}>
            <option value="today">Today</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="custom">Custom range</option>
          </select>
          {preset === "custom" && <>
            <input type="date" aria-label="From" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className={sel} />
            <input type="date" aria-label="To" value={cTo} onChange={(e) => setCTo(e.target.value)} className={sel} />
          </>}
          <Button size="sm" variant="outline" onClick={() => void q.refetch()}><RefreshCw className={q.isFetching ? "animate-spin" : ""} />Refresh</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("ledger-filtered", csvRows(rows), CSV_COLS)}><Download />Export filtered ({rows.length})</Button>
          {checked.size > 0 && <Button size="sm" variant="outline" onClick={() => downloadCsv("ledger-selected", csvRows(all.filter((r) => checked.has(r.id))), CSV_COLS)}><Download />Export selected ({checked.size})</Button>}
        </div>

        {q.error && <p className="mt-3 text-sm text-destructive">{(q.error as Error).message}</p>}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-2"><input type="checkbox" aria-label="Select all" checked={allChecked} onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))} className="size-4 accent-primary" /></th>
                <th className="p-2">Timestamp</th><th className="p-2">Type</th><th className="p-2">Account</th><th className="p-2">Asset</th>
                <th className="p-2 text-right">Amount</th><th className="p-2 text-right">Fee</th><th className="p-2">Status</th><th className="p-2">TxID / Ref</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">Loading ledger...</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={9} className="p-4 text-center text-muted-foreground">No transactions match these filters.</td></tr>}
              {rows.slice(0, 500).map((r) => (
                <tr key={r.id} onClick={() => setOpen(r)} className="cursor-pointer border-b border-border/60 hover:bg-muted/40">
                  <td className="p-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Select row" checked={checked.has(r.id)} onChange={() => toggle(r.id)} className="size-4 accent-primary" /></td>
                  <td className="num p-2">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="p-2">{TYPE_LABEL[typeOf(r)]}</td>
                  <td className="p-2">{r.name ?? "-"} <span className="font-mono text-muted-foreground">{r.uid}</span></td>
                  <td className="p-2">{r.currency}</td>
                  <td className={`num p-2 text-right ${r.amount < 0 ? "text-bear" : "text-bull"}`}>{fmt(r.amount)}</td>
                  <td className="num p-2 text-right">{r.fee ? fmt(r.fee) : "-"}</td>
                  <td className="p-2">{r.status}</td>
                  <td className="max-w-[160px] truncate p-2 font-mono text-muted-foreground">{r.tx_hash ?? r.ref_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 500 && <p className="mt-2 text-[11px] text-muted-foreground">Showing the latest 500 of {rows.length}; narrow the filters or export to see all.</p>}
        </div>
      </section>

      <Sheet open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {open && <Inspector r={open} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Line({ label, value, mono, onCopy }: { label: string; value: React.ReactNode; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-1.5 break-all text-right ${mono ? "font-mono" : ""}`}>{value ?? "-"}{onCopy && <button type="button" aria-label={`Copy ${label}`} onClick={onCopy}><Copy className="size-3.5" /></button>}</span>
    </div>
  );
}

function Inspector({ r }: { r: any }) {
  const link = explorer(r.network, r.tx_hash);
  return (
    <div className="space-y-4">
      <SheetTitle>Transaction Inspector</SheetTitle>
      <SheetDescription>{TYPE_LABEL[typeOf(r)]} - {r.status}</SheetDescription>
      <section>
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">Reference</h4>
        <Line label="Internal reference" value={r.id} mono onCopy={() => copy(r.id, "Reference")} />
        <Line label="Transaction hash" value={r.tx_hash} mono onCopy={r.tx_hash ? () => copy(r.tx_hash, "Hash") : undefined} />
        {link && <a href={link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline"><ExternalLink className="size-3.5" />Open in blockchain explorer</a>}
        <Line label="Source record" value={`${r.ref_table} / ${r.ref_id}`} mono />
      </section>
      <section>
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">Account</h4>
        <Line label="Name" value={r.name} />
        <Line label="UID" value={r.uid} mono onCopy={r.uid ? () => copy(r.uid, "UID") : undefined} />
        <Line label="Email" value={r.email} />
        <Line label="KYC level" value={`Level ${r.kycLevel}`} />
      </section>
      <section>
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">Fee breakdown</h4>
        <Line label="Gross amount" value={`${fmt(r.amount)} ${r.currency}`} />
        <Line label="Network (gas) fee" value="Not recorded" />
        <Line label="Platform fee" value={r.fee ? `${fmt(r.fee)} ${r.currency}` : "0"} />
        <Line label="Net executed amount" value={`${fmt(r.net)} ${r.currency}`} />
      </section>
      <section>
        <h4 className="text-[10px] uppercase tracking-widest text-muted-foreground">Execution</h4>
        <Line label="Timestamp" value={new Date(r.created_at).toLocaleString()} />
        <Line label="Account's last known IP" value={r.ip} mono />
        <Line label="Network" value={r.network} />
        <Line label="Destination wallet" value={r.destination} mono onCopy={r.destination ? () => copy(r.destination, "Address") : undefined} />
        {r.note && <Line label="Note" value={r.note} />}
      </section>
    </div>
  );
}
