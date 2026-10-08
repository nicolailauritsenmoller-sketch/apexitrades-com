import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Landmark, Download } from "lucide-react";
import { getTreasury, getUserWalletBalance, treasuryTransfer } from "@/lib/treasury.functions";
import { AssetIcon } from "@/lib/asset-icons";
import { downloadCsv } from "@/lib/csv";

type Dir = "send" | "receive" | "fund" | "withdraw";
const DIRS: { id: Dir; label: string; hint: string }[] = [
  { id: "send", label: "Send to customer", hint: "Treasury → customer wallet" },
  { id: "receive", label: "Receive from customer", hint: "Customer wallet → treasury" },
  { id: "fund", label: "Fund treasury", hint: "Record an external top-up" },
  { id: "withdraw", label: "Withdraw treasury", hint: "Record an external payout" },
];
const fmt = (v: unknown, d = 8) => Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: d });

/** Platform treasury: balances, atomic transfers with customers, and an immutable ledger. */
export function TreasuryWalletPanel() {
  const qc = useQueryClient();
  const load = useServerFn(getTreasury);
  const transfer = useServerFn(treasuryTransfer);
  const userBal = useServerFn(getUserWalletBalance);

  const q = useQuery({ queryKey: ["admin-treasury"], queryFn: () => load(), refetchInterval: 20_000 });
  const [dir, setDir] = useState<Dir>("send");
  const [currency, setCurrency] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [userId, setUserId] = useState("");
  const [search, setSearch] = useState("");
  const [ledgerFilter, setLedgerFilter] = useState<"all" | Dir>("all");

  const wallets = (q.data?.wallets ?? []) as any[];
  const profiles = (q.data?.profiles ?? []) as any[];
  const ledger = (q.data?.ledger ?? []) as any[];
  const needsUser = dir === "send" || dir === "receive";

  const matches = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return profiles.slice(0, 8);
    return profiles
      .filter((p) => [p.display_name, p.email, p.uid].some((v) => String(v ?? "").toLowerCase().includes(s)))
      .slice(0, 8);
  }, [profiles, search]);
  const selected = profiles.find((p) => p.id === userId);

  const ub = useQuery({
    queryKey: ["admin-treasury-userbal", userId, currency],
    queryFn: () => userBal({ data: { userId, currency } }),
    enabled: needsUser && !!userId,
  });

  const treasuryBal = Number(wallets.find((w) => w.currency === currency)?.balance ?? 0);
  const amt = Number(amount);
  const insufficient =
    amt > 0 &&
    (((dir === "send" || dir === "withdraw") && amt > treasuryBal) ||
      (dir === "receive" && ub.data && amt > ub.data.balance));

  const send = useMutation({
    mutationFn: (auditReason: string) =>
      transfer({ data: { direction: dir, userId: needsUser ? userId : null, currency, amount: amt, reason: auditReason } }),
    onSuccess: (r) => {
      toast.success(`Done. Treasury ${currency} balance: ${fmt(r.treasury_balance)}`);
      setAmount("");
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-treasury"] });
      void qc.invalidateQueries({ queryKey: ["admin-treasury-userbal"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = ledger.filter((l) => ledgerFilter === "all" || l.direction === ledgerFilter);
  const canSubmit = amt > 0 && reason.trim().length >= 5 && (!needsUser || !!userId) && !insufficient && !send.isPending;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {wallets.map((w) => (
          <button
            key={w.currency}
            onClick={() => setCurrency(w.currency)}
            className={`touch-manipulation rounded-xl border p-3 text-left ${currency === w.currency ? "border-primary bg-primary/10" : "border-border/70 bg-card/60"}`}
          >
            <div className="flex items-center gap-2">
              <AssetIcon symbol={w.currency} size={18} />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{w.currency}</span>
            </div>
            <p className="num mt-1 text-lg font-semibold">{fmt(w.balance)}</p>
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
        <header className="mb-3 flex items-center gap-2">
          <Landmark className="size-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Move funds</h3>
        </header>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {DIRS.map((d) => (
            <button
              key={d.id}
              onClick={() => setDir(d.id)}
              className={`touch-manipulation rounded-full border px-3 py-1.5 text-xs ${dir === d.id ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
              title={d.hint}
            >
              {d.label}
            </button>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {needsUser && (
            <div className="space-y-1.5">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search customer by name, email or UID"
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
              />
              <ul className="max-h-48 overflow-auto rounded-md border border-border/60">
                {matches.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => setUserId(p.id)}
                      className={`flex w-full touch-manipulation items-center gap-2 px-2.5 py-1.5 text-left text-xs ${userId === p.id ? "bg-primary/10" : "hover:bg-secondary"}`}
                    >
                      <span className="font-medium">{p.display_name}</span>
                      <span className="truncate text-muted-foreground">{p.email}</span>
                      <span className="num ml-auto text-muted-foreground">{p.uid}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selected && (
                <p className="text-[11px] text-muted-foreground">
                  {selected.display_name} holds <span className="num text-foreground">{ub.isLoading ? "…" : fmt(ub.data?.balance)}</span> {currency}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm"
              >
                {wallets.map((w) => (
                  <option key={w.currency}>{w.currency}</option>
                ))}
              </select>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="num h-9 flex-1 rounded-md border border-border bg-background px-2 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Treasury holds <span className="num text-foreground">{fmt(treasuryBal)}</span> {currency}
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason (required, recorded in the ledger and audit log)"
              className="w-full rounded-md border border-border bg-background p-2 text-sm"
            />
            {insufficient && <p className="text-xs text-ops-red">Insufficient balance for this transfer.</p>}
            <div className="flex justify-end border-t border-border pt-3"><Button disabled={!canSubmit} onClick={() => setConfirming(true)}>
              {send.isPending && <Loader2 className="animate-spin" />}{DIRS.find((d) => d.id === dir)?.label}
            </Button></div>
            <AdminActionConfirm open={confirming} title="Confirm treasury transfer" description={`${fmt(amt)} ${currency} - ${DIRS.find((d) => d.id === dir)?.hint}. ${reason}`} pending={send.isPending} destructive={dir === "withdraw" || dir === "receive"} onClose={() => setConfirming(false)} onConfirm={async (auditReason) => { await send.mutateAsync(auditReason); }} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/50">
        <header className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <h3 className="font-display text-sm font-semibold">Treasury ledger</h3>
          <select
            value={ledgerFilter}
            onChange={(e) => setLedgerFilter(e.target.value as any)}
            className="ml-auto h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="all">All movements</option>
            {DIRS.map((d) => (
              <option key={d.id} value={d.id}>{d.label}</option>
            ))}
          </select>
          <button
            onClick={() =>
              downloadCsv(
                `treasury-ledger-${new Date().toISOString().slice(0, 10)}`,
                rows.map((l) => ({
                  date: l.created_at,
                  direction: l.direction,
                  currency: l.currency,
                  amount: l.amount,
                  customer: l.counterparty?.display_name ?? "",
                  customer_uid: l.counterparty?.uid ?? "",
                  treasury_balance_after: l.treasury_balance_after,
                  customer_balance_after: l.user_balance_after ?? "",
                  reason: l.reason,
                  operator: l.actor_name ?? "",
                })) as any,
              )
            }
            className="inline-flex h-8 touch-manipulation items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold"
          >
            <Download className="size-3.5" /> Export CSV
          </button>
        </header>
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No treasury movements yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Treasury after</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2">Operator</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const inflow = l.direction === "receive" || l.direction === "fund";
                  return (
                    <tr key={l.id} className="border-b border-border/50 last:border-0">
                      <td className="num px-3 py-2 text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 font-semibold ${inflow ? "text-ops-emerald" : "text-ops-red"}`}>
                          {inflow ? <ArrowDownLeft className="size-3" /> : <ArrowUpRight className="size-3" />}
                          {DIRS.find((d) => d.id === l.direction)?.label ?? l.direction}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {l.counterparty ? (
                          <>
                            {l.counterparty.display_name} <span className="num text-muted-foreground">{l.counterparty.uid}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className={`num px-3 py-2 text-right font-semibold ${inflow ? "text-ops-emerald" : "text-ops-red"}`}>
                        {inflow ? "+" : "-"}
                        {fmt(l.amount)} {l.currency}
                      </td>
                      <td className="num px-3 py-2 text-right">{fmt(l.treasury_balance_after)}</td>
                      <td className="max-w-[240px] truncate px-3 py-2" title={l.reason}>{l.reason}</td>
                      <td className="px-3 py-2 text-muted-foreground">{l.actor_name ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
