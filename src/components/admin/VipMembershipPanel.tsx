import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown, Hourglass, X } from "lucide-react";
import { setUserVipStatus } from "@/lib/admin.functions";
import { VIP1_THRESHOLD_USDT, isVip, isVipPending } from "@/lib/vip-tiers";

type VipAction = "approve" | "reject" | "grant" | "revoke" | "pending";

/**
 * VIP membership request review plus a manual grant/revoke control for admins.
 */
export function VipMembershipPanel({
  userId,
  userName,
  vipTier,
  onChanged,
}: {
  userId: string;
  userName?: string | null;
  vipTier?: string | null;
  onChanged?: () => void;
}) {
  const [note, setNote] = useState("");
  const run = useServerFn(setUserVipStatus);
  const pending = isVipPending(vipTier);
  const active = isVip(vipTier);

  const mutation = useMutation({
    mutationFn: (action: VipAction) =>
      run({ data: { userId, action, note: note.trim() || undefined } }),
    onSuccess: (_res, action) => {
      toast.success(
        action === "approve" || action === "grant"
          ? "VIP status activated."
          : action === "pending"
            ? "Account marked as VIP (Pending)."
            : "VIP status removed.",
      );
      setNote("");
      onChanged?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  const currentValue = active ? "vip1" : pending ? "vip_pending" : "regular";

  return (
    <div className="space-y-3">
      {pending && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-400/15 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-ops-amber">
            <Hourglass className="size-3.5" /> VIP Membership Request Pending
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {userName ?? "This user"} reached the {VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT
            threshold and is awaiting manual VIP approval.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("approve")}
              className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-bull px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-bull/90 disabled:opacity-50"
            >
              <Check className="size-3.5" /> Approve VIP
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("reject")}
              className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-ops-red px-3 py-2 text-xs font-bold text-background transition-colors hover:bg-ops-red/90 disabled:opacity-50"
            >
              <X className="size-3.5" /> Reject VIP
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Crown className={`size-3.5 ${active ? "text-ops-amber" : "text-muted-foreground"}`} />
            VIP status
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Manual override — assign or revoke VIP regardless of balance.
          </p>
        </div>
        <select
          value={currentValue}
          disabled={mutation.isPending}
          onChange={(e) => {
            const next = e.target.value;
            if (next === currentValue) return;
            mutation.mutate(next === "vip1" ? "grant" : next === "vip_pending" ? "pending" : "revoke");
          }}
          className="touch-manipulation rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold outline-none focus:border-primary disabled:opacity-50"
        >
          <option value="regular">Regular</option>
          <option value="vip_pending">VIP (Pending)</option>
          <option value="vip1">VIP</option>
        </select>
      </div>

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note sent to the user on rejection"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
      />
    </div>
  );
}
