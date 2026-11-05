import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyKyc } from "@/lib/kyc.functions";
import { institutionalizeCopy } from "@/lib/institutional-copy";
import { LiveSelfieCapture, type SelfieCaptureMeta } from "@/components/profile/LiveSelfieCapture";
import { Button } from "@/components/ui/button";

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

export type Level2Payload = {
  livenessSelfiePath: string;
  livenessCapture: SelfieCaptureMeta;

};

/** Lv.2 verification requires only live camera selfie evidence. */
export function KycLevel2Panel({
  kyc,
  userId,
  onSubmit,
}: {
  kyc: KycData;
  userId: string | null;
  onSubmit: (payload: Level2Payload) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [selfie, setSelfie] = useState<{ file: File; meta: SelfieCaptureMeta } | null>(null);

  const level1Approved = kyc?.level1Status === "approved";
  const level2 = kyc?.level2Status ?? "unsubmitted";

  if (!level1Approved) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        Complete and pass Lv.1 verification to unlock enhanced due diligence.
      </p>
    );
  }

  if (level2 === "pending") {
    return (
      <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-xs text-amber-400">
        Your Lv.2 biometric selfie is under compliance review. This usually takes 1-2 business days.
      </p>
    );
  }

  if (level2 === "approved") {
    return (
      <p className="rounded-xl border border-bull/40 bg-bull/5 p-4 text-xs text-bull">
        Lv.2 verification approved - unlimited daily withdrawals, priority support, high-leverage
        trading and fiat rails are enabled.
      </p>
    );
  }

  async function upload(file: File, kind: string) {
    const path = `${userId}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!selfie) {
      toast.error("Capture a live facial selfie before submitting Lv.2.");
      return;
    }
    setBusy(true);
    try {
      const livenessSelfiePath = await upload(selfie.file, "level2-selfie");
      await onSubmit({
        livenessSelfiePath,
        livenessCapture: selfie.meta,
      });
      setSelfie(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
      {level2 === "rejected" && (
        <div className="rounded-xl border border-bear/40 bg-bear/5 p-3 text-xs text-bear sm:col-span-2">
          <p className="font-semibold">
            Your Lv.2 submission was rejected. Please re-submit below.
          </p>
           {kyc?.level2AdminNote && <p className="mt-1">Compliance note: {institutionalizeCopy(kyc.level2AdminNote)}</p>}
        </div>
      )}
      <div className="sm:col-span-2">
        <LiveSelfieCapture label="Biometric facial selfie capture (required)" value={selfie} onChange={setSelfie} headTurn />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
      >
        {busy ? "Submitting..." : "Submit Lv.2 verification"}
      </Button>
    </form>
  );
}
