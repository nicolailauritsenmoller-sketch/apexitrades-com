import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Crown, Search, X } from "lucide-react";
import { getVipMembers, setUserVipStatus } from "@/lib/admin.functions";
import { PendingVipPanel, usePendingVipRequests } from "./PendingVipPanel";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ActiveVipTable({ onOpen }: { onOpen?: (userId: string) => void }) {
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
      qc.invalidateQueries({ queryKey: ["admin-vip-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-user-workspace"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  const rows = useMemo(() => {
    const all = (q.data ?? []) as any[];
    const t = term.trim().toLowerCase();
    if (!t) return all;
    return all.filter((r) =>
      [r.displayName, r.uid, r.email].some((v) => String(v ?? "").toLowerCase().includes(t)),
    );
  }, [q.data, term]);

  if (q.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading VIP members…</p>;
  }

  return (
    <div className="space-y-3">
      <label className="flex max-w-sm items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
        <Search className="size-4 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search name, user ID or email"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
          <Crown className="size-4 text-ops-amber" /> No active VIP members.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/70 text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-3 font-semibold">User ID</th>
                <th className="py-2 pr-3 font-semibold">Name</th>
                <th className="py-2 pr-3 font-semibold">Email</th>
                <th className="py-2 pr-3 font-semibold">Total equity</th>
                <th className="py-2 pr-3 font-semibold">Date promoted</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-border/40 last:border-0">
                  <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                    {r.uid ?? "—"}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Crown className="size-3.5 text-ops-amber" />
                      {r.displayName}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate py-2.5 pr-3 text-xs text-muted-foreground">
                    {r.email ?? "—"}
                  </td>
                  <td className="num py-2.5 pr-3 text-xs font-semibold">
                    {r.equityUsdt.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                    {fmtDate(r.promotedAt)}
                  </td>
                  <td className="py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(r.userId)}
                        className="flex touch-manipulation items-center gap-1 rounded-md border border-ops-red/25 bg-ops-red-bg px-2.5 py-1.5 text-[11px] font-bold text-ops-red transition-colors hover:bg-ops-red/20 disabled:opacity-50"
                      >
                        <X className="size-3" /> Revoke VIP
                      </button>
                      {onOpen && (
                        <button
                          type="button"
                          onClick={() => onOpen(r.userId)}
                          className="touch-manipulation rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                        >
                          Account details
                        </button>
                      )}
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

/** Dedicated VIP membership management view: pending queue + active members. */
export function VipMembershipsPage({ onOpen }: { onOpen?: (userId: string) => void }) {
  const [view, setView] = useState<"pending" | "active">("pending");
  const pending = usePendingVipRequests(true);
  const pendingCount = ((pending.data ?? []) as any[]).length;

  const TABS = [
    { id: "pending" as const, label: "Pending VIP requests", count: pendingCount },
    { id: "active" as const, label: "Active VIP members", count: null as number | null },
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
            {t.count ? (
              <span className="ml-2 rounded-full bg-ops-red-bg px-1.5 py-0.5 text-[10px] font-bold text-ops-red">
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "pending" ? <PendingVipPanel onOpen={onOpen} /> : <ActiveVipTable onOpen={onOpen} />}
    </div>
  );
}
