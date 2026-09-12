import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyKyc } from "@/lib/kyc.functions";
import {
  DOC_TYPES,
  FileUploadField,
  IMAGE_TYPES,
  type UploadStage,
} from "@/components/profile/FileUploadField";

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

export type Level2Payload = {
  livenessSelfiePath: string;
  proofPath: string;
  proofType: "utility_bill" | "bank_statement" | "tax_document";
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
  const [proofType, setProofType] = useState<Level2Payload["proofType"]>("utility_bill");
  const [taxId, setTaxId] = useState("");
  const [selfie, setSelfie] = useState<File | null>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("idle");

  const level1Approved = kyc?.level1Status === "approved";
  const level2 = kyc?.level2Status ?? "unsubmitted";

  if (!level1Approved) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        Complete and pass Level 1 verification to unlock enhanced verification.
      </p>
    );
  }

  if (level2 === "pending") {
    return (
      <p className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-4 text-xs text-amber-400">
        Your Level 2 documents are under compliance review. This usually takes 1–2 business days.
      </p>
    );
  }

  if (level2 === "approved") {
    return (
      <p className="rounded-xl border border-bull/40 bg-bull/5 p-4 text-xs text-bull">
        Level 2 verification approved — unlimited daily withdrawals, priority support, high-leverage
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
    if (!selfie || !proof) {
      toast.error("Upload both a live selfie and your proof document.");
      return;
    }
    setBusy(true);
    try {
      const [livenessSelfiePath, proofPath] = await Promise.all([
        upload(selfie, "level2-selfie"),
        upload(proof, "level2-proof"),
      ]);
      await onSubmit({
        livenessSelfiePath,
        proofPath,
        proofType,
        taxId: taxId.trim() || undefined,
      });
      setSelfie(null);
      setProof(null);
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
            Your Level 2 submission was rejected. Please re-submit below.
          </p>
          {kyc?.level2AdminNote && <p className="mt-1">Reviewer note: {kyc.level2AdminNote}</p>}
        </div>
      )}
      <select
        value={proofType}
        onChange={(e) => setProofType(e.target.value as Level2Payload["proofType"])}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      >
        <option value="utility_bill">Utility bill</option>
        <option value="bank_statement">Bank statement</option>
        <option value="tax_document">Tax document</option>
      </select>
      <input
        value={taxId}
        onChange={(e) => setTaxId(e.target.value)}
        placeholder="SSN / Tax ID (optional)"
        className="rounded-md border border-border bg-background px-3 py-2 text-sm"
      />
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <FileUploadField
          label="Live selfie / liveness photo"
          accept="image/*"
          allowed={IMAGE_TYPES}
          capture="user"
          file={selfie}
          onChange={setSelfie}
          stage={stage}
        />
        <FileUploadField
          label="Proof of address document"
          accept="image/*,application/pdf"
          allowed={DOC_TYPES}
          file={proof}
          onChange={setProof}
          stage={stage}
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
      >
        {busy ? "Submitting…" : "Submit Level 2 documents"}
      </button>
    </form>
  );
}
