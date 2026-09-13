import { useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PasswordInput } from "@/components/PasswordInput";
import {
  getWithdrawalPasswordStatus,
  resetWithdrawalPassword,
  setWithdrawalPassword,
} from "@/lib/withdrawal-password.functions";

export function WithdrawalPasswordForm() {
  const fetchStatus = useServerFn(getWithdrawalPasswordStatus);
  const save = useServerFn(setWithdrawalPassword);
  const reset = useServerFn(resetWithdrawalPassword);
  const qc = useQueryClient();

  const status = useQuery({
    queryKey: ["withdrawal-password-status"],
    queryFn: () => fetchStatus(),
  });

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const isSet = status.data?.isSet ?? false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return toast.error("Withdrawal password must be at least 6 characters.");
    if (next !== confirm) return toast.error("Withdrawal passwords do not match.");
    setBusy(true);
    try {
      const res = await save({
        data: { newPassword: next, ...(isSet ? { currentPassword: current } : {}) },
      });
      toast.success(res.message);
      setCurrent("");
      setNext("");
      setConfirm("");
      qc.invalidateQueries({ queryKey: ["withdrawal-password-status"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <p className="text-xs text-muted-foreground sm:col-span-3">
        {isSet
          ? `A withdrawal password is set${
              status.data?.updatedAt
                ? ` (last changed ${new Date(status.data.updatedAt).toLocaleDateString()})`
                : ""
            }. It can only be changed once every 7 working days.`
          : "Set a withdrawal password. You will be asked for it every time you request a withdrawal."}
      </p>
      {isSet && (
        <PasswordInput
          required
          placeholder="Current withdrawal password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <PasswordInput
        required
        placeholder="New withdrawal password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <PasswordInput
        required
        placeholder="Confirm withdrawal password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy}
        className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-3"
      >
        {busy ? "Saving…" : isSet ? "Change withdrawal password" : "Set withdrawal password"}
      </button>
    </form>
  );
}
