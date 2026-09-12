import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OtpInput } from "@/components/OtpInput";

/**
 * Asks for a live TOTP (or recovery) code before a high-risk action runs.
 * The parent performs the action with the returned code so the server verifies it.
 */
export function StepUpCodeDialog({
  open,
  title,
  description,
  busy,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  onOpenChange: (next: boolean) => void;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);

  useEffect(() => {
    if (!open) {
      setCode("");
      setRecovery("");
      setUseRecovery(false);
    }
  }, [open]);

  const value = useRecovery ? recovery.trim() : code;
  const ready = useRecovery ? recovery.trim().split(/\s+/).length === 12 : code.length === 6;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">{description}</p>
        {useRecovery ? (
          <textarea
            value={recovery}
            onChange={(e) => setRecovery(e.target.value.toLowerCase())}
            placeholder="word1 word2 word3 …"
            rows={3}
            autoFocus
            className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        ) : (
          <OtpInput value={code} onChange={setCode} autoFocus disabled={busy} />
        )}
        <button
          type="button"
          disabled={!ready || busy}
          onClick={() => onSubmit(value)}
          className="w-full touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Verifying…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={() => setUseRecovery((v) => !v)}
          className="text-xs text-primary underline-offset-2 hover:underline"
        >
          {useRecovery ? "Use authenticator code" : "Use recovery phrase"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
