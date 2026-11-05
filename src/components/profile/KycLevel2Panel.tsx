import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyKyc } from "@/lib/kyc.functions";
import { institutionalizeCopy } from "@/lib/institutional-copy";
import {
  DOC_TYPES,
  FileUploadField,

  type UploadStage,
} from "@/components/profile/FileUploadField";
import { LiveSelfieCapture, type SelfieCaptureMeta } from "@/components/profile/LiveSelfieCapture";
import { Button } from "@/components/ui/button";
import { KycEvidencePreview } from "@/components/profile/KycEvidencePreview";
import { isRecentProofDate, proofDateWindow } from "@/lib/kyc-level2-schema";

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

export type Level2Payload = {
  livenessSelfiePath: string;
  livenessCapture: SelfieCaptureMeta;
  proofPath?: string;
  proofType?: "utility_bill" | "bank_statement" | "tax_document";
  proofIssuedAt?: string;
  taxId?: string;
};

/** Enhanced (Level 2) verification: liveness selfie + proof of address / tax ID. */
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
  const [proofType, setProofType] = useState<NonNullable<Level2Payload["proofType"]>>("utility_bill");
  const [proofIssuedAt, setProofIssuedAt] = useState("");
  const [selfie, setSelfie] = useState<{ file: File; meta: SelfieCaptureMeta } | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");

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
        Your Lv.2 documents are under compliance review. This usually takes 1-2 business days.
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
    if (proof && !isRecentProofDate(proofIssuedAt)) {
      toast.error("Proof of Address must be dated within the last 3 months.");
      return;
    }
    setBusy(true);
    setStage("uploading");
    try {
      const [livenessSelfiePath, proofPath] = await Promise.all([
        upload(selfie.file, "level2-selfie"),
        proof ? upload(proof, "level2-proof") : Promise.resolve(undefined),
      ]);
      setStage("done");
      await onSubmit({
        livenessSelfiePath,
        livenessCapture: selfie.meta,
        proofPath,
        proofType: proof ? proofType : undefined,
        proofIssuedAt: proof ? proofIssuedAt : undefined,
      });
      setSelfie(null);
      setProof(null);
      setProofIssuedAt("");
      setStage("idle");
    } catch (err) {
      setStage("idle");
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
      <label className="space-y-1 text-xs text-muted-foreground">Proof of Address document type (optional)
        <select
        value={proofType}
        onChange={(e) => setProofType(e.target.value as NonNullable<Level2Payload["proofType"]>)}
        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="utility_bill">Utility bill</option>
        <option value="bank_statement">Bank statement</option>
        <option value="tax_document">Tax document</option>
      </select>
      </label>
      <label className="space-y-1 text-xs text-muted-foreground">Document issue date {proof ? "(required)" : "(if provided)"}
      <input type="date" required={Boolean(proof)} min={proofDateWindow().min} max={proofDateWindow().max}
        value={proofIssuedAt}
        onChange={(e) => setProofIssuedAt(e.target.value)}
        className="block w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      </label>
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <LiveSelfieCapture label="Biometric facial selfie capture (required)" value={selfie} onChange={setSelfie} />
        <div className="space-y-2">
        <FileUploadField
          label="Proof of Address (PoA) document (optional)"
          accept="image/*,application/pdf"
          allowed={DOC_TYPES}
          file={proof}
          onChange={setProof}
          stage={stage}
        />
        <p className="text-xs text-muted-foreground">Utility bill, bank statement or tax document dated within the last 3 months.</p>
        <KycEvidencePreview file={proof} />
        {proof && <Button type="button" variant="ghost" size="sm" onClick={() => { setProof(null); setProofIssuedAt(""); }}>Remove document</Button>}
        </div>
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
      >
        {busy ? "Submitting..." : "Submit Lv.2 documents"}
      </Button>
    </form>
  );
}
