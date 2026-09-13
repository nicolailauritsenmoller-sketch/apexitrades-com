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
  const [forgot, setForgot] = useState(false);
  const [accountPassword, setAccountPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const isSet = status.data?.isSet ?? false;

  function clearFields() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setAccountPassword("");
    setTotpCode("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 6) return toast.error("Withdrawal password must be at least 6 characters.");
    if (next !== confirm) return toast.error("Withdrawal passwords do not match.");
    setBusy(true);
    try {
      const res = forgot
        ? await reset({
            data: {
              accountPassword,
              newPassword: next,
              ...(totpCode ? { totpCode } : {}),
            },
          })
        : await save({
            data: { newPassword: next, ...(isSet ? { currentPassword: current } : {}) },
          });
      toast.success(res.message);
      clearFields();
      setForgot(false);
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
        {forgot
          ? "Confirm your account password (and an authenticator code if two-factor is on) to set a new withdrawal password straight away."
          : isSet
            ? `A withdrawal password is set${
                status.data?.updatedAt
                  ? ` (last changed ${new Date(status.data.updatedAt).toLocaleDateString()})`
                  : ""
              }. It can only be changed once every 7 working days.`
            : "Set a withdrawal password. You will be asked for it every time you request a withdrawal."}
      </p>
      {isSet && !forgot && (
        <PasswordInput
          required
          placeholder="Current withdrawal password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      {forgot && (
        <>
          <PasswordInput
            required
            placeholder="Account password"
            value={accountPassword}
            onChange={(e) => setAccountPassword(e.target.value)}
          />
          <input
            inputMode="numeric"
            placeholder="Authenticator code (if enabled)"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="touch-manipulation rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </>
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
        {busy
          ? "Saving…"
          : forgot
            ? "Reset withdrawal password"
            : isSet
              ? "Change withdrawal password"
              : "Set withdrawal password"}
      </button>
      {isSet && (
        <button
          type="button"
          onClick={() => {
            setForgot((v) => !v);
            clearFields();
          }}
          className="touch-manipulation text-xs font-medium text-primary underline-offset-2 hover:underline sm:col-span-3"
        >
          {forgot ? "Back to changing it normally" : "Forgot your withdrawal password?"}
        </button>
      )}
    </form>
  );
}
