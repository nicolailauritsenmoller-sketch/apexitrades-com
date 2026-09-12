import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Download, KeySquare, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TwoFactorSetupDialog } from "./TwoFactorSetupDialog";
import { StepUpCodeDialog } from "./StepUpCodeDialog";
import {
  disableTwoFactor,
  getTwoFactorState,
  regenerateRecoveryCodes,
  type TwoFactorState,
} from "@/lib/two-factor.functions";

export function TwoFactorSection() {
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getTwoFactorState);
  const disable = useServerFn(disableTwoFactor);
  const regenerate = useServerFn(regenerateRecoveryCodes);

  const state = useQuery({
    queryKey: ["two-factor-state"],
    queryFn: () => fetchState() as Promise<TwoFactorState>,
  });

  const [setupOpen, setSetupOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [stepUp, setStepUp] = useState<null | "disable" | "regenerate">(null);
  const [busy, setBusy] = useState(false);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  const enabled = state.data?.enabled ?? false;

  async function runStepUp(code: string) {
    setBusy(true);
    try {
      if (stepUp === "disable") {
        await disable({ data: { code } });
        toast.success("Two-factor authentication disabled");
        setManageOpen(false);
      } else {
        const res = (await regenerate({ data: { code } })) as { recoveryCodes: string[] };
        setNewCodes(res.recoveryCodes);
        toast.success("New recovery codes generated");
      }
      setStepUp(null);
      await queryClient.invalidateQueries({ queryKey: ["two-factor-state"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
        <div>
          <p className="text-sm font-semibold">Authenticator app</p>
          <p className="text-xs text-muted-foreground">
            Google Authenticator, Authy, 1Password and other TOTP apps.
          </p>
          {enabled && state.data?.recoveryRemaining != null ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {state.data.recoveryRemaining} unused recovery code(s) remaining.
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
              enabled ? "border-bull/40 text-bull" : "border-border text-muted-foreground"
            }`}
          >
            {state.isLoading ? "…" : enabled ? "Enabled" : "Disabled"}
          </span>
          <button
            type="button"
            onClick={() => (enabled ? setManageOpen(true) : setSetupOpen(true))}
            className="touch-manipulation rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          >
            {enabled ? "Manage 2FA" : "Enable 2FA"}
          </button>
        </div>
      </div>

      <TwoFactorSetupDialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
        onEnabled={() => void queryClient.invalidateQueries({ queryKey: ["two-factor-state"] })}
      />

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage two-factor authentication</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-bull/40 bg-bull/10 p-3 text-xs text-bull">
            <ShieldCheck className="size-4" /> Authenticator app protection is active.
          </div>
          <button
            type="button"
            onClick={() => setStepUp("regenerate")}
            className="flex w-full touch-manipulation items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
          >
            <KeySquare className="size-4" /> Generate new recovery codes
          </button>
          <button
            type="button"
            onClick={() => setStepUp("disable")}
            className="w-full touch-manipulation rounded-md border border-destructive/50 px-3 py-2 text-sm font-semibold text-destructive"
          >
            Disable 2FA
          </button>

          {newCodes.length ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="grid grid-cols-2 gap-2 font-mono text-sm">
                {newCodes.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard.writeText(newCodes.join("\n"));
                    toast.success("Recovery codes copied");
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <Copy className="size-3.5" /> Copy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([newCodes.join("\n")], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "velocity-trade-recovery-codes.txt";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs"
                >
                  <Download className="size-3.5" /> Download
                </button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <StepUpCodeDialog
        open={stepUp !== null}
        busy={busy}
        title={stepUp === "disable" ? "Confirm disabling 2FA" : "Confirm new recovery codes"}
        description={
          stepUp === "disable"
            ? "Enter a current authenticator code or a recovery code. Other sessions will be signed out."
            : "Enter a current authenticator code. Your existing recovery codes stop working."
        }
        onOpenChange={(next) => (next ? null : setStepUp(null))}
        onSubmit={runStepUp}
      />
    </div>
  );
}
