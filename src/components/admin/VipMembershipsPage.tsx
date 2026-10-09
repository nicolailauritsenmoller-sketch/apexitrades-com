import { useMemo, useState } from "react";
import { VipPerkDialog } from "./VipPerkDialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown, Search, X } from "lucide-react";
import {
  getDeclinedVipRequests,
  getVipMembers,
  setUserVipStatus,
} from "@/lib/admin.functions";
import { PendingVipPanel, usePendingVipRequests } from "./PendingVipPanel";
import { VipFeeTiersPanel } from "./VipFeeTiersPanel";

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const usdt = (n: number) =>
  `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;

const TH = "py-2 pr-3 font-semibold";
const HEAD_ROW =
  "border-b border-border/70 text-[11px] uppercase tracking-widest text-muted-foreground";

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
      <Search className="size-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search name, user ID or email"
        className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

function filterRows<T extends Record<string, any>>(rows: T[], term: string) {
  const t = term.trim().toLowerCase();
  if (!t) return rows;
  return rows.filter((r) =>
    [r.displayName, r.uid, r.email].some((v) => String(v ?? "").toLowerCase().includes(t)),
  );
}

function rowClass(clickable: boolean) {
  return `border-b border-border/40 last:border-0 ${
    clickable ? "cursor-pointer transition-colors hover:bg-muted/40" : ""
  }`;
}

/* ------------------------------- Approved -------------------------------- */

function ApprovedVipTable({ onOpen }: { onOpen?: (userId: string) => void }) {
  const qc = useQueryClient();
  const fetchMembers = useServerFn(getVipMembers);
  const run = useServerFn(setUserVipStatus);
  const [term, setTerm] = useState("");

  const q = useQuery({
    queryKey: ["admin-vip-members"],
    queryFn: () => fetchMembers(),
    refetchInterval: 30_000,
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => run({ data: { userId, action: "revoke" } }),
    onSuccess: () => {
      toast.success("VIP status revoked.");
      qc.invalidateQueries({ queryKey: ["admin-vip-members"] });
      qc.invalidateQueries({ queryKey: ["admin-vip-declined"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-user-workspace"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  const rows = useMemo(() => filterRows((q.data ?? []) as any[], term), [q.data, term]);

  if (q.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading VIP members…</p>;
  }

  return (
    <div className="space-y-3">
      <SearchBox value={term} onChange={setTerm} />
      {rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Crown className="size-4 text-ops-amber" /> No approved VIP members.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className={HEAD_ROW}>
                <th className={TH}>User ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Total equity</th>
                <th className={TH}>Date approved</th>
                <th className={TH}>Approved by</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.userId}
                  onClick={() => onOpen?.(r.userId)}
                  className={rowClass(Boolean(onOpen))}
                >
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                    {r.uid ?? "-"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Crown className="size-3.5 text-ops-amber" />
                      {r.displayName}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-xs text-muted-foreground">
                    {r.email ?? "-"}
                  </td>
                  <td className="num py-2.5 pr-3 text-xs font-semibold">{usdt(r.equityUsdt)}</td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {fmtDate(r.promotedAt)}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {r.approvedByName ?? "-"}
                    {r.approvedById && (
                      <span className="block font-mono text-[10px] opacity-70">
                        {String(r.approvedById).slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(r.userId)}
                        className="flex touch-manipulation items-center gap-1 rounded-md border border-ops-red/25 bg-ops-red-bg px-2.5 py-1.5 text-[11px] font-bold text-ops-red transition-colors hover:bg-ops-red/20 disabled:opacity-50"
                      >
                        <X className="size-3" /> Revoke VIP
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Declined -------------------------------- */

function DeclinedVipTable({ onOpen }: { onOpen?: (userId: string) => void }) {
  const qc = useQueryClient();
  const fetchDeclined = useServerFn(getDeclinedVipRequests);
  const run = useServerFn(setUserVipStatus);
  const [term, setTerm] = useState("");

  const q = useQuery({
    queryKey: ["admin-vip-declined"],
    queryFn: () => fetchDeclined(),
    refetchInterval: 60_000,
  });

  const approve = useMutation({
    mutationFn: (userId: string) => run({ data: { userId, action: "grant" } }),
    onSuccess: () => {
      toast.success("VIP status approved and activated.");
      qc.invalidateQueries({ queryKey: ["admin-vip-declined"] });
      qc.invalidateQueries({ queryKey: ["admin-vip-members"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-user-workspace"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  const rows = useMemo(() => filterRows((q.data ?? []) as any[], term), [q.data, term]);

  if (q.isLoading) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">Loading declined requests…</p>
    );
  }

  return (
    <div className="space-y-3">
      <SearchBox value={term} onChange={setTerm} />
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No declined VIP submissions on record.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead>
              <tr className={HEAD_ROW}>
                <th className={TH}>User ID</th>
                <th className={TH}>Name</th>
                <th className={TH}>Email</th>
                <th className={TH}>Deposit amount</th>
                <th className={TH}>Decline reason</th>
                <th className={TH}>Date declined</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.userId}
                  onClick={() => onOpen?.(r.userId)}
                  className={rowClass(Boolean(onOpen))}
                >
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                    {r.uid ?? "-"}
                  </td>
                  <td className="py-2.5 pr-3 font-semibold">{r.displayName}</td>
                  <td className="max-w-[180px] truncate py-2.5 pr-3 text-xs text-muted-foreground">
                    {r.email ?? "-"}
                  </td>
                  <td className="num py-2.5 pr-3 text-xs font-semibold">
                    {r.depositUsdt > 0 ? usdt(r.depositUsdt) : "-"}
                  </td>
                  <td className="max-w-[220px] py-2.5 pr-3 text-xs text-muted-foreground">
                    {r.reason ?? (r.action === "vip.revoke" ? "VIP status revoked" : "No reason recorded")}
                    {r.declinedByName && (
                      <span className="block text-[10px] opacity-70">by {r.declinedByName}</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {fmtDate(r.declinedAt)}
                  </td>
                  <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={approve.isPending}
                        onClick={() => approve.mutate(r.userId)}
                        className="flex touch-manipulation items-center gap-1 rounded-md border border-ops-emerald/25 bg-ops-emerald-bg px-2.5 py-1.5 text-[11px] font-bold text-ops-emerald transition-colors hover:bg-ops-emerald/20 disabled:opacity-50"
                      >
                        <Check className="size-3" /> Re-evaluate & approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Page ---------------------------------- */

/** Dedicated VIP membership management view: pending, approved and declined. */
export function VipMembershipsPage({ onOpen }: { onOpen?: (userId: string) => void }) {
  const [view, setView] = useState<"pending" | "approved" | "declined" | "tiers">("pending");
  const pending = usePendingVipRequests(true);
  const pendingCount = ((pending.data ?? []) as any[]).length;

  const TABS = [
    { id: "pending" as const, label: "Pending requests", count: pendingCount },
    { id: "approved" as const, label: "Approved VIPs", count: 0 },
    { id: "declined" as const, label: "Declined requests", count: 0 },
    { id: "tiers" as const, label: "Fee tiers & engine", count: 0 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setView(t.id)}
            className={`touch-manipulation rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              view === t.id
                ? "border-border bg-muted/60 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-2 rounded-full bg-ops-red-bg px-1.5 py-0.5 text-[10px] font-bold text-ops-red">
                {t.count}
              </span>
            )}
          </button>
        ))}
        <div className="ml-auto"><VipPerkDialog /></div>
      </div>

      {view === "pending" && <PendingVipPanel onOpen={onOpen} />}
      {view === "approved" && <ApprovedVipTable onOpen={onOpen} />}
      {view === "declined" && <DeclinedVipTable onOpen={onOpen} />}
      {view === "tiers" && <VipFeeTiersPanel onOpen={onOpen} />}
    </div>
  );
}
