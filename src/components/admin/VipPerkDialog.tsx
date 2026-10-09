import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { getUserDirectory } from "@/lib/admin.functions";
import { getVipPerks, setVipPerk } from "@/lib/desk-workflows.functions";
import { UserVipFeesPanel } from "./UserVipFeesPanel";

const inp = "mt-1 min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const num = (v: string) => (v.trim() === "" ? null : Number(v));

/** Grant custom fee discounts, leverage ceiling, priority withdrawals and exact fee schedules to one account. */
export function VipPerkDialog() {
  const [open, setOpen] = useState(false);
  const dir = useServerFn(getUserDirectory);
  const readPerks = useServerFn(getVipPerks);
  const save = useServerFn(setVipPerk);
  const users = useQuery({ queryKey: ["perk-directory"], queryFn: () => dir(), enabled: open });
  const perks = useQuery({ queryKey: ["vip-perks"], queryFn: () => readPerks(), enabled: open });
  const [term, setTerm] = useState("");
  const [userId, setUserId] = useState("");
  const [f, setF] = useState({ maker: "", taker: "", lev: "", priority: false, reason: "" });

  const list = (((users.data as any)?.users ?? users.data ?? []) as any[])
    .filter((u) => term && [u.uid, u.email, u.display_name, u.id].some((v) => String(v ?? "").toLowerCase().includes(term.toLowerCase())))
    .slice(0, 6);

  function pick(id: string) {
    setUserId(id);
    const p = (perks.data ?? {})[id] ?? {};
    setF({ maker: p.makerDiscountPct?.toString() ?? "", taker: p.takerDiscountPct?.toString() ?? "", lev: p.maxLeverage?.toString() ?? "", priority: !!p.priorityWithdrawals, reason: "" });
  }

  const m = useMutation({
    mutationFn: () => save({ data: { userId, makerDiscountPct: num(f.maker), takerDiscountPct: num(f.taker), maxLeverage: num(f.lev), priorityWithdrawals: f.priority, reason: f.reason } }),
    onSuccess: () => { toast.success("Custom VIP perk applied."); void perks.refetch(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Sparkles />Apply Custom VIP Perk</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogTitle>Apply Custom VIP Perk</DialogTitle>
          <DialogDescription>Grant bespoke benefits to a high-net-worth account. Every change is audited.</DialogDescription>
          <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search UID, email or name" className={inp} />
          {list.length > 0 && (
            <ul className="divide-y divide-border rounded-md border border-border">
              {list.map((u) => (
                <li key={u.id}><button type="button" onClick={() => { pick(u.id); setTerm(""); }} className="w-full px-3 py-2 text-left text-xs hover:bg-muted">{u.display_name} <span className="text-muted-foreground">{u.email} - {u.uid}</span></button></li>
              ))}
            </ul>
          )}
          {userId && (
            <div className="space-y-3">
              <p className="font-mono text-[11px] text-muted-foreground">Account {userId.slice(0, 8)}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs">Maker fee discount %<input inputMode="decimal" value={f.maker} onChange={(e) => setF({ ...f, maker: e.target.value })} className={inp} /></label>
                <label className="text-xs">Taker fee discount %<input inputMode="decimal" value={f.taker} onChange={(e) => setF({ ...f, taker: e.target.value })} className={inp} /></label>
                <label className="text-xs">Daily leverage limit (x)<input inputMode="numeric" value={f.lev} onChange={(e) => setF({ ...f, lev: e.target.value })} className={inp} /></label>
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={f.priority} onChange={(e) => setF({ ...f, priority: e.target.checked })} className="size-4 accent-primary" />Priority withdrawal queue</label>
              <textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} rows={2} placeholder="Audit reason (required)" className="w-full rounded-md border border-input bg-background p-2 text-sm" />
              <div className="flex justify-end"><Button disabled={m.isPending || f.reason.trim().length < 5} onClick={() => m.mutate()}>{m.isPending && <Loader2 className="animate-spin" />}Save perk</Button></div>
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Tier, exact fee schedule & account manager</p>
                <UserVipFeesPanel userId={userId} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
