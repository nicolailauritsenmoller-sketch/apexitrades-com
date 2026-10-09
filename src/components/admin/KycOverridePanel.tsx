import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { overrideKycStatus } from "@/lib/desk-workflows.functions";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";

/** Compliance-only manual KYC status override; every change needs an audit note. */
export function KycOverridePanel({ userId, level, onDone }: { userId: string; level: 1 | 2; onDone?: () => void }) {
  const run = useServerFn(overrideKycStatus);
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<"approved" | "rejected" | "pending">("approved");
  const [confirm, setConfirm] = useState(false);
  const m = useMutation({
    mutationFn: (reason: string) => run({ data: { userId, level, status, reason } }),
    onSuccess: () => { toast.success(`Level ${level} status overridden to ${status}.`); setConfirm(false); setEnabled(false); onDone?.(); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-lg border border-border p-3">
      <label className="flex items-center justify-between gap-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><ShieldAlert className="size-3.5 text-ops-amber" />Manual KYC Status Override</span>
        <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-4 accent-primary" />
      </label>
      {enabled && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select aria-label="Override status" value={status} onChange={(e) => setStatus(e.target.value as any)} className="min-h-9 rounded-md border border-input bg-background px-2 text-xs">
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="pending">Back to pending</option>
          </select>
          <button type="button" onClick={() => setConfirm(true)} className="min-h-9 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Apply override</button>
          <p className="w-full text-[11px] text-muted-foreground">Compliance officers only. The customer is notified and the change is written to the audit log.</p>
        </div>
      )}
      <AdminActionConfirm open={confirm} title={`Override KYC Level ${level}`} description={`Set Level ${level} to "${status}". A mandatory audit note is required.`} pending={m.isPending} destructive={status === "rejected"} onClose={() => setConfirm(false)} onConfirm={async (reason) => { await m.mutateAsync(reason); }} />
    </div>
  );
}
