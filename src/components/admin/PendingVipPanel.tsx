import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown, Hourglass, X } from "lucide-react";
import { getPendingVipRequests, setUserVipStatus } from "@/lib/admin.functions";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Control Center queue of accounts waiting for manual VIP approval.
 * Also exported as a hook so the sidebar/header can show the live count.
 */
export function usePendingVipRequests(enabled: boolean) {
  const fetch = useServerFn(getPendingVipRequests);
  return useQuery({
    queryKey: ["admin-vip-pending"],
    queryFn: () => fetch(),
    enabled,
    refetchInterval: 15_000,
  });
}

export function PendingVipPanel({ onOpen }: { onOpen?: (userId: string) => void }) {
  const qc = useQueryClient();
  const q = usePendingVipRequests(true);
  const run = useServerFn(setUserVipStatus);
  const rows = (q.data ?? []) as any[];

  const mutation = useMutation({
    mutationFn: (input: { userId: string; action: "approve" | "reject" }) =>
      run({ data: input }),
    onSuccess: (_res, input) => {
      toast.success(
        input.action === "approve" ? "VIP status approved and activated." : "VIP request rejected.",
      );
      qc.invalidateQueries({ queryKey: ["admin-vip-pending"] });
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
      qc.invalidateQueries({ queryKey: ["admin-user-workspace"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  if (q.isLoading) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Loading VIP requests…</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-center text-sm text-muted-foreground">
        <Crown className="size-4 text-ops-amber" /> No pending VIP requests — queue clear.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-[11px] uppercase tracking-widest text-muted-foreground">
            <th className="py-2 pr-3 font-semibold">User</th>
            <th className="py-2 pr-3 font-semibold">User ID</th>
            <th className="py-2 pr-3 font-semibold">Email</th>
            <th className="py-2 pr-3 font-semibold">Deposit amount</th>
            <th className="py-2 pr-3 font-semibold">Date</th>
            <th className="py-2 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-b border-border/40 last:border-0">
              <td className="py-2.5 pr-3">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Hourglass className="size-3.5 text-ops-amber" />
                  {r.displayName}
                </span>
              </td>
              <td className="py-2.5 pr-3 font-mono text-xs text-muted-foreground">
                {r.uid ?? "—"}
              </td>
              <td className="max-w-[180px] truncate py-2.5 pr-3 text-xs text-muted-foreground">
                {r.email ?? "—"}
              </td>
              <td className="py-2.5 pr-3">
                <span className="num text-xs font-semibold">
                  {r.approvedUsdt > 0
                    ? `${r.approvedUsdt.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`
                    : r.lastDepositAmount != null
                      ? `${r.lastDepositAmount.toLocaleString("en-US", { maximumFractionDigits: 6 })} ${r.lastDepositCoin ?? ""}`
                      : "—"}
                </span>
              </td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                {fmtDate(r.requestedAt)}
              </td>
              <td className="py-2.5">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ userId: r.userId, action: "approve" })}
                    className="flex touch-manipulation items-center gap-1 rounded-md border border-ops-emerald/25 bg-ops-emerald-bg px-2.5 py-1.5 text-[11px] font-bold text-ops-emerald transition-colors hover:bg-ops-emerald/20 disabled:opacity-50"
                  >
                    <Check className="size-3" /> Approve VIP
                  </button>
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate({ userId: r.userId, action: "reject" })}
                    className="flex touch-manipulation items-center gap-1 rounded-md border border-ops-red/25 bg-ops-red-bg px-2.5 py-1.5 text-[11px] font-bold text-ops-red transition-colors hover:bg-ops-red/20 disabled:opacity-50"
                  >
                    <X className="size-3" /> Reject VIP
                  </button>
                  {onOpen && (
                    <button
                      type="button"
                      onClick={() => onOpen(r.userId)}
                      className="touch-manipulation rounded-md border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Open
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
