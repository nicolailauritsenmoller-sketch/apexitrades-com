import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Crown, Hourglass, X } from "lucide-react";
import { setUserVipStatus } from "@/lib/admin.functions";
import { VIP1_THRESHOLD_USDT, isVip, isVipPending } from "@/lib/vip-tiers";

/**
 * VIP membership request review plus a manual grant/revoke toggle for admins.
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
    mutationFn: (action: "approve" | "reject" | "grant" | "revoke") =>
      run({ data: { userId, action, note: note.trim() || undefined } }),
    onSuccess: (_res, action) => {
      toast.success(
        action === "approve" || action === "grant"
          ? "VIP status activated."
          : "VIP status removed.",
      );
      setNote("");
      onChanged?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Action failed."),
  });

  return (
    <div className="space-y-3">
      {pending && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
            <Hourglass className="size-3" /> VIP membership request
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
              className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
            >
              <Check className="size-3.5" /> Approve VIP
            </button>
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate("reject")}
              className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-ops-red/40 bg-ops-red/10 px-3 py-2 text-xs font-bold text-ops-red disabled:opacity-50"
            >
              <X className="size-3.5" /> Reject VIP
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-semibold">
            <Crown className={`size-3.5 ${active ? "text-amber-500" : "text-muted-foreground"}`} />
            {active ? "VIP 1 active" : pending ? "Upgrade pending review" : "Regular member"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Manual override — assign or revoke VIP regardless of balance.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(active ? "revoke" : "grant")}
          className={`touch-manipulation rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50 ${
            active
              ? "border-border text-muted-foreground hover:text-foreground"
              : "border-amber-500/40 bg-amber-500/10 text-amber-500"
          }`}
        >
          {active ? "Revoke VIP" : "Assign VIP"}
        </button>
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
