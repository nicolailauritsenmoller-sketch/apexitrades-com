import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Link2, Wallet } from "lucide-react";
import { forceMatchDeposit, getWithdrawalRisk } from "@/lib/desk-workflows.functions";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";

const sel = "min-h-9 rounded-md border border-input bg-background px-2 text-xs";

export function AssetNetworkFilters({ asset, onAsset, network, onNetwork }: { asset: string; onAsset: (v: string) => void; network: string; onNetwork: (v: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <label className="flex items-center gap-1.5">Asset
        <select aria-label="Filter by asset" value={asset} onChange={(e) => onAsset(e.target.value)} className={sel}>
          {["all", "USDT", "BTC", "ETH"].map((a) => <option key={a} value={a}>{a === "all" ? "All assets" : a}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1.5">Network
        <select aria-label="Filter by network" value={network} onChange={(e) => onNetwork(e.target.value)} className={sel}>
          {["all", "TRC20", "ERC20", "BEP20"].map((a) => <option key={a} value={a}>{a === "all" ? "All networks" : a}</option>)}
        </select>
      </label>
    </div>
  );
}

/** Paste a transaction hash to approve and credit a delayed pending deposit. */
export function ForceMatchTool({ onDone }: { onDone: () => void }) {
  const run = useServerFn(forceMatchDeposit);
  const [hash, setHash] = useState("");
  const [open, setOpen] = useState(false);
  const m = useMutation({
    mutationFn: (reason: string) => run({ data: { txHash: hash.trim(), reason } }),
    onSuccess: (r) => { toast.success(`Credited ${r.amount} ${r.coin}.`); setHash(""); onDone(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="mb-3 rounded-lg border border-border p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold"><Link2 className="size-3.5" />Manual On-Chain Credit / Force Match</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <input value={hash} onChange={(e) => setHash(e.target.value)} placeholder="Paste transaction hash" className="min-h-9 min-w-[220px] flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs" />
        <button type="button" disabled={hash.trim().length < 10} onClick={() => setOpen(true)} className="min-h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50">Force Match</button>
      </div>
      <AdminActionConfirm open={open} title="Force Match Deposit" description="The pending deposit carrying this hash will be approved and credited to the customer." destructive={false} pending={m.isPending} onClose={() => setOpen(false)} onConfirm={async (reason) => { await m.mutateAsync(reason); }} />
    </div>
  );
}

export function useWithdrawalRisk() {
  const fetch = useServerFn(getWithdrawalRisk);
  return useQuery({ queryKey: ["withdrawal-risk"], queryFn: () => fetch(), refetchInterval: 15_000 });
}

export function WithdrawalRiskFlags({ flags }: { flags?: { newAddress: boolean; overDaily: boolean; dailyLimit: number | null; priority: boolean } }) {
  if (!flags) return null;
  const pill = "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase";
  return (
    <>
      {flags.priority && <span className={`${pill} bg-ops-amber/20 text-ops-amber`}>VIP priority</span>}{" "}
      {flags.newAddress && <span className={`${pill} bg-warning/20 text-warning`}>New address</span>}{" "}
      {flags.overDaily && <span className={`${pill} bg-destructive/20 text-destructive`}>Over daily limit{flags.dailyLimit != null ? ` (${flags.dailyLimit.toLocaleString()})` : ""}</span>}
    </>
  );
}

/** Treasury liquidity vs. the currently selected withdrawals. */
export function TreasuryLiquidity({ treasury, selected }: { treasury: { currency: string; balance: number }[] | null; selected: any[] }) {
  if (!treasury) return null;
  const need: Record<string, number> = {};
  for (const w of selected) need[w.coin] = (need[w.coin] ?? 0) + Number(w.amount);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 text-xs">
      <span className="flex items-center gap-1.5 font-semibold"><Wallet className="size-3.5" />Treasury liquidity</span>
      {treasury.map((t) => {
        const n = need[t.currency] ?? 0;
        const short = n > Number(t.balance);
        return (
          <span key={t.currency} className={`num rounded-md border px-2 py-1 ${short ? "border-destructive/50 text-destructive" : "border-border"}`}>
            {t.currency} {Number(t.balance).toLocaleString()}{n > 0 ? ` / need ${n.toLocaleString()}` : ""}
          </span>
        );
      })}
    </div>
  );
}
