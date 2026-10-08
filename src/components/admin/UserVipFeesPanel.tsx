import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getUserVipFees, setAccountManager, setUserFeeOverride, setVipLevel } from "@/lib/vip-tiers.functions";

const KEYS = ["spot_maker", "spot_taker", "futures_maker", "futures_taker", "scalp_maker", "scalp_taker"] as const;

/** Tier level, custom fee override and account manager for one account. */
export function UserVipFeesPanel({ userId }: { userId: string }) {
  const fetch = useServerFn(getUserVipFees);
  const saveOverride = useServerFn(setUserFeeOverride);
  const saveManager = useServerFn(setAccountManager);
  const saveLevel = useServerFn(setVipLevel);
  const q = useQuery({ queryKey: ["admin-user-vip-fees", userId], queryFn: () => fetch({ data: { userId } }) });
  const d = q.data as any;
  const [rates, setRates] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [mgr, setMgr] = useState({ name: "", email: "" });

  useEffect(() => {
    if (!d) return;
    setRates(Object.fromEntries(KEYS.map((k) => [k, d.override?.[k] == null ? "" : String(d.override[k])])));
    setNote(d.override?.note ?? "");
    setMgr({ name: d.account?.account_manager_name ?? "", email: d.account?.account_manager_email ?? "" });
  }, [d]);

  const onErr = (e: Error) => toast.error(e.message);
  const override = useMutation({
    mutationFn: (clear: boolean) =>
      saveOverride({
        data: {
          userId,
          clear,
          ...(Object.fromEntries(KEYS.map((k) => [k, rates[k] === "" || rates[k] === undefined ? null : Number(rates[k])])) as any),
          note: note.trim() || null,
        },
      }),
    onSuccess: () => { toast.success("Fee override saved."); void q.refetch(); },
    onError: onErr,
  });
  const manager = useMutation({
    mutationFn: (clear: boolean) => saveManager({ data: { userId, name: clear ? null : mgr.name.trim() || null, email: clear ? null : mgr.email.trim() || null } }),
    onSuccess: () => { toast.success("Account manager updated."); void q.refetch(); },
    onError: onErr,
  });
  const level = useMutation({
    mutationFn: (l: number) => saveLevel({ data: { userId, level: l } }),
    onSuccess: () => { toast.success("Tier updated."); void q.refetch(); },
    onError: onErr,
  });

  if (q.isLoading) return <p className="text-xs text-muted-foreground">Loading fees...</p>;
  if (!d) return <p className="text-xs text-ops-red">{(q.error as Error)?.message ?? "Failed."}</p>;
  const acc = d.account;
  const t = d.tier;
  const eff = (k: string) => (d.override?.[k] ?? null) !== null ? `${Number(d.override[k]).toFixed(3)}% (custom)` : `${Number(t?.[k] ?? 0).toFixed(3)}%`;

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md border border-primary/40 px-2 py-0.5 font-bold text-primary">Tier {d.level}{t ? ` - ${t.name}` : ""}</span>
        <select value={d.level} onChange={(e) => level.mutate(Number(e.target.value))} className="h-7 rounded-md border border-border bg-background px-1 text-[11px]">
          {d.tiers.map((x: any) => <option key={x.level} value={x.level}>Set Tier {x.level}</option>)}
        </select>
        {acc?.grace_until && <span className="text-ops-amber">Grace until {new Date(acc.grace_until).toLocaleDateString()}</span>}
        {acc?.recommended_level != null && <span className="text-ops-emerald">Qualifies for Tier {acc.recommended_level}</span>}
      </div>
      {acc && (
        <p className="text-[11px] text-muted-foreground">
          30d - spot ${Number(acc.spot_volume_30d).toLocaleString()} · futures ${Number(acc.futures_volume_30d).toLocaleString()} · scalp ${Number(acc.scalp_volume_30d).toLocaleString()} · portfolio ${Number(acc.portfolio_usdt).toLocaleString()}
        </p>
      )}

      <div className="rounded-lg border border-border p-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Custom fee override (%) - blank uses tier rate, negative maker = rebate</p>
        <div className="grid grid-cols-2 gap-1.5">
          {KEYS.map((k) => (
            <label key={k} className="text-[10px] text-muted-foreground">
              {k.replace("_", " ")} <span className="opacity-70">(now {eff(k)})</span>
              <input type="number" step="0.001" value={rates[k] ?? ""} onChange={(e) => setRates((p) => ({ ...p, [k]: e.target.value }))} className="mt-0.5 h-7 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" />
            </label>
          ))}
        </div>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / agreement reference" className="mt-1.5 h-7 w-full rounded-md border border-border bg-background px-2 text-xs" />
        <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button size="sm" disabled={override.isPending} onClick={() => override.mutate(false)}>{override.isPending && <Loader2 className="animate-spin" />}Save Changes</Button>
          {d.override && <button disabled={override.isPending} onClick={() => override.mutate(true)} className="rounded-md border border-border px-2">Clear</button>}
        </div>
      </div>

      <div className="rounded-lg border border-border p-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">Assigned account manager (Tier 3+)</p>
        {d.level < 3 ? (
          <p className="text-[11px] text-muted-foreground">Available once the account reaches Tier 3.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-1.5">
              <input value={mgr.name} onChange={(e) => setMgr((p) => ({ ...p, name: e.target.value }))} placeholder="Name" className="h-7 rounded-md border border-border bg-background px-2 text-xs" />
              <input value={mgr.email} onChange={(e) => setMgr((p) => ({ ...p, email: e.target.value }))} placeholder="Email" type="email" className="h-7 rounded-md border border-border bg-background px-2 text-xs" />
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <Button size="sm" disabled={manager.isPending || !mgr.name.trim()} onClick={() => manager.mutate(false)}>{manager.isPending && <Loader2 className="animate-spin" />}Assign VIP Manager</Button>
              {acc?.account_manager_email && <a href={`mailto:${acc.account_manager_email}`} className="rounded-md border border-border px-2 py-1.5">Email</a>}
              {acc?.account_manager_name && <button onClick={() => manager.mutate(true)} className="rounded-md border border-border px-2">Remove</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
