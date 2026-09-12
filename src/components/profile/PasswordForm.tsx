import { useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";
import { StepUpCodeDialog } from "@/components/security/StepUpCodeDialog";
import { getTwoFactorState, verifyStepUp, type TwoFactorState } from "@/lib/two-factor.functions";

export function PasswordForm({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [stepUpOpen, setStepUpOpen] = useState(false);

  const fetchState = useServerFn(getTwoFactorState);
  const stepUp = useServerFn(verifyStepUp);
  const twoFactor = useQuery({
    queryKey: ["two-factor-state"],
    queryFn: () => fetchState() as Promise<TwoFactorState>,
  });

  async function applyChange() {
    if (!email) return toast.error("No email on this account.");
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);

      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (next !== confirm) return toast.error("New passwords do not match.");
    if (!email) return toast.error("No email on this account.");

    if (twoFactor.data?.enabled) {
      setStepUpOpen(true);
      return;
    }
    await applyChange();
  }

  return (
    <>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <PasswordInput
          required
          placeholder="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <PasswordInput
          required
          placeholder="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordInput
          required
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <button
          type="submit"
          disabled={busy}
          className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-3"
        >
          {busy ? "Updating…" : "Change password"}
        </button>
      </form>

      <StepUpCodeDialog
        open={stepUpOpen}
        busy={busy}
        title="Confirm password change"
        description="Enter the current code from your authenticator app to change your password."
        onOpenChange={(open) => (open ? null : setStepUpOpen(false))}
        onSubmit={async (code) => {
          setBusy(true);
          try {
            await stepUp({ data: { code } });
            setStepUpOpen(false);
            setBusy(false);
            await applyChange();
          } catch (err) {
            setBusy(false);
            toast.error((err as Error).message);
          }
        }}
      />
    </>
  );
}
