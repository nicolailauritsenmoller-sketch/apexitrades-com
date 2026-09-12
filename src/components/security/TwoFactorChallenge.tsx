import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { OtpInput } from "@/components/OtpInput";
import { verifyTwoFactorChallenge } from "@/lib/two-factor.functions";

/** Full-screen login interceptor: no protected view renders until this passes. */
export function TwoFactorChallenge({ onVerified }: { onVerified: () => void }) {
  const verify = useServerFn(verifyTwoFactorChallenge);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await verify({ data: { code: useRecovery ? recovery.trim() : code } });
      onVerified();
    } catch (err) {
      toast.error((err as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-2xl border border-border p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-primary" />
          <h1 className="text-lg font-semibold">Two-factor authentication</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {useRecovery
            ? "Enter one of your single-use recovery codes."
            : "Enter the 6-digit code from your authenticator app to continue."}
        </p>

        {useRecovery ? (
          <input
            value={recovery}
            onChange={(e) => setRecovery(e.target.value.toUpperCase())}
            placeholder="XXXX-XXXX"
            autoFocus
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-center font-mono text-sm tracking-widest"
          />
        ) : (
          <OtpInput value={code} onChange={setCode} autoFocus disabled={busy} />
        )}

        <button
          type="submit"
          disabled={busy || (useRecovery ? recovery.length < 8 : code.length !== 6)}
          className="w-full touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Verify"}
        </button>

        <div className="flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => setUseRecovery((v) => !v)}
            className="text-primary underline-offset-2 hover:underline"
          >
            {useRecovery ? "Use authenticator code" : "Use a recovery code"}
          </button>
          <button
            type="button"
            onClick={() => {
              void supabase.auth.signOut().then(() => {
                window.location.replace("/");
              });
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  );
}
