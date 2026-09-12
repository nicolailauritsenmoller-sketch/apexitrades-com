import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Copy, Download, Loader2, ShieldCheck, Smartphone } from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { OtpInput } from "@/components/OtpInput";
import { confirmTwoFactorSetup, startTwoFactorSetup } from "@/lib/two-factor.functions";

type Step = 1 | 2 | 3 | 4;

export function TwoFactorSetupDialog({
  open,
  onOpenChange,
  onEnabled,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onEnabled: () => void;
}) {
  const begin = useServerFn(startTwoFactorSetup);
  const confirm = useServerFn(confirmTwoFactorSetup);

  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState("");
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [stored, setStored] = useState(false);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setSecret("");
      setQr("");
      setCode("");
      setCodes([]);
      setStored(false);
    }
  }, [open]);

  async function goToAppSetup() {
    setBusy(true);
    try {
      const res = (await begin()) as { secret: string; otpauthUri: string };
      setSecret(res.secret);
      setQr(await QRCode.toDataURL(res.otpauthUri, { margin: 1, width: 240 }));
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    try {
      const res = (await confirm({ data: { code } })) as { recoveryCodes: string[] };
      setCodes(res.recoveryCodes);
      setStep(4);
      onEnabled();
    } catch (err) {
      toast.error((err as Error).message);
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  function copyCodes() {
    void navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Recovery codes copied");
  }

  function downloadCodes() {
    const blob = new Blob(
      [`Velocity Trade recovery codes\nKeep these safe. Each code works once.\n\n${codes.join("\n")}\n`],
      { type: "text/plain" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "velocity-trade-recovery-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (step === 4 && !stored ? null : onOpenChange(next))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 4 ? "Save your recovery codes" : "Set up two-factor authentication"}
          </DialogTitle>
        </DialogHeader>

        {step < 4 ? (
          <ol className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            {["Method", "App setup", "Verify"].map((label, index) => (
              <li
                key={label}
                className={`rounded-full border px-2 py-0.5 ${
                  step === index + 1 ? "border-primary text-primary" : "border-border"
                }`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={goToAppSetup}
              disabled={busy}
              className="flex w-full touch-manipulation items-center gap-3 rounded-xl border border-primary/50 bg-primary/5 p-4 text-left"
            >
              <Smartphone className="size-5 text-primary" />
              <span>
                <span className="block text-sm font-semibold">Authenticator app</span>
                <span className="block text-xs text-muted-foreground">
                  Google Authenticator, Authy, 1Password and similar apps.
                </span>
              </span>
              {busy ? <Loader2 className="ml-auto size-4 animate-spin" /> : null}
            </button>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Scan this QR code with your authenticator app, or enter the setup key manually.
            </p>
            {qr ? (
              <img
                src={qr}
                alt="Two-factor authentication QR code"
                className="mx-auto rounded-lg bg-white p-2"
                width={200}
                height={200}
              />
            ) : null}
            <div className="rounded-xl border border-border p-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Setup key</p>
              <p className="break-all font-mono text-sm">{secret}</p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(secret);
                  toast.success("Setup key copied");
                }}
                className="mt-2 inline-flex touch-manipulation items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs"
              >
                <Copy className="size-3.5" /> Copy setup key
              </button>
            </div>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="w-full touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Continue
            </button>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Enter the current 6-digit code shown in your authenticator app.
            </p>
            <OtpInput value={code} onChange={setCode} autoFocus disabled={busy} />
            <button
              type="button"
              disabled={busy || code.length !== 6}
              onClick={verify}
              className="w-full touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & enable"}
            </button>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-bull/40 bg-bull/10 p-3 text-xs text-bull">
              <ShieldCheck className="size-4" /> Two-factor authentication is now enabled.
            </div>
            <p className="text-xs text-muted-foreground">
              Each code can be used once if you lose access to your authenticator app. They are never
              shown again.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-border p-3 font-mono text-sm">
              {codes.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={copyCodes}
                className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
              >
                <Copy className="size-3.5" /> Copy codes
              </button>
              <button
                type="button"
                onClick={downloadCodes}
                className="flex flex-1 touch-manipulation items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs"
              >
                <Download className="size-3.5" /> Download
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={stored}
                onChange={(e) => setStored(e.target.checked)}
                className="mt-0.5 size-4"
              />
              I have securely stored these recovery codes
            </label>
            <button
              type="button"
              disabled={!stored}
              onClick={() => onOpenChange(false)}
              className="flex w-full touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              <Check className="size-4" /> Done
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
