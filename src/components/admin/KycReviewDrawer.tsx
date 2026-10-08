import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { APPROVE_BTN, DANGER_BTN } from "@/lib/admin-accents";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2, X } from "lucide-react";
import { toast } from "sonner";
import { getKycDocumentUrls, reviewKyc, reviewKycLevel2 } from "@/lib/admin.functions";
import { DocumentViewer } from "@/components/admin/DocumentViewer";

export const REJECTION_CODES = [
  { code: "DOC_EXPIRED", label: "Doc Expired", message: "The submitted document has expired. Please upload a valid, unexpired document." },
  { code: "IMAGE_BLURRY", label: "Image Blurry", message: "The document image is blurry or unreadable. Please upload a clear, well-lit photo." },
  { code: "NAME_MISMATCH", label: "Name Mismatch", message: "The name on the document does not match your account details." },
  { code: "FAILED_SELFIE_MATCH", label: "Failed Selfie Match", message: "The selfie could not be matched to the document photo." },
  { code: "ADDRESS_UNVERIFIED", label: "Address Unverified", message: "The proof of address could not be verified. Please upload a recent utility bill or bank statement." },
  { code: "SOF_INSUFFICIENT", label: "Source of Funds Insufficient", message: "The source of funds evidence provided is insufficient." },
  { code: "ALTERED_DOCUMENT", label: "Suspected Altered Document", message: "The document appears altered and could not be accepted." },
  { code: "UNSUPPORTED_DOC", label: "Unsupported Document", message: "This document type or issuing country is not supported." },
] as const;

type Tier = "L1" | "L2";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "-"}</span>
    </div>
  );
}

export function TierBadge({ tier }: { tier: Tier }) {
  return (
    <span
      className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        tier === "L1" ? "border-primary/50 text-primary" : "border-ops-amber/50 text-ops-amber"
      }`}
    >
      {tier === "L1" ? "KYC Lv.1 Basic" : "KYC Lv.2 Advanced"}
    </span>
  );
}

/** Tiered compliance inspection: Level 1 and Level 2 reviewed independently. */
export function KycReviewDrawer({
  row,
  onClose,
  onDone,
  initialTier,
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
  initialTier?: Tier;
}) {
  const fetchDocs = useServerFn(getKycDocumentUrls);
  const reviewL1 = useServerFn(reviewKyc);
  const reviewL2 = useServerFn(reviewKycLevel2);
  const level2Status: string = row.level2_status ?? "unsubmitted";
  const [tier, setTier] = useState<Tier>(
    initialTier ?? (row.status !== "pending" && level2Status === "pending" ? "L2" : "L1"),
  );
  const [rejecting, setRejecting] = useState(false);
  const [code, setCode] = useState<string>("");
  const [note, setNote] = useState("");

  const docs = useQuery({
    queryKey: ["admin-kyc-docs", row.id],
    queryFn: () => fetchDocs({ data: { id: row.id } }),
  });
  const d = docs.data as
    | { document: string | null; selfie: string | null; level2Selfie: string | null; level2Proof: string | null }
    | undefined;

  const act = useMutation({
    mutationFn: (vars: { action: "approve" | "reject" }) => {
      const picked = REJECTION_CODES.find((r) => r.code === code);
      const msg =
        vars.action === "reject" && picked
          ? `${picked.label}: ${picked.message}${note.trim() ? ` - ${note.trim()}` : ""}`
          : note.trim() || undefined;
      const payload = { id: row.id, action: vars.action, note: msg, code: vars.action === "reject" ? code : undefined };
      return tier === "L1" ? reviewL1({ data: payload }) : reviewL2({ data: payload });
    },
    onSuccess: (_r, vars) => {
      toast.success(`${tier === "L1" ? "Level 1" : "Level 2"} ${vars.action === "approve" ? "approved" : "rejected"} - user notified.`);
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = tier === "L1" ? row.status : level2Status;
  const canReview = status === "pending";

  return (
    <div className="fixed inset-0 z-[115] flex justify-end bg-black/60 backdrop-blur-sm">
      <button aria-label="Close" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-xl flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileCheck2 className="size-4 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">Compliance review - {row.full_name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">User {String(row.user_id).slice(0, 8)}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="ml-auto touch-manipulation rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </header>

        <div className="flex gap-1 border-b border-border px-4 py-2">
          {(["L1", "L2"] as const).map((t) => {
            const s = t === "L1" ? row.status : level2Status;
            return (
              <button
                key={t}
                onClick={() => {
                  setTier(t);
                  setRejecting(false);
                }}
                className={`flex-1 touch-manipulation rounded-md border px-2 py-1.5 text-xs font-semibold ${
                  tier === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {t === "L1" ? "Level 1 - Basic" : "Level 2 - Advanced"}
                <span className="ml-1.5 text-[10px] uppercase opacity-80">({s})</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="flex items-center gap-2">
            <TierBadge tier={tier} />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Status: {status}</span>
          </div>

          {tier === "L1" ? (
            <>
              <section className="rounded-xl border border-border/70 bg-card/60 p-3">
                <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Personal details & residence</h4>
                <Row label="Legal name" value={row.full_name} />
                <Row label="Date of birth" value={row.date_of_birth} />
                <Row label="Country" value={row.country} />
                <Row label="Residential address" value={row.address} />
                <Row label="Government ID" value={`${row.document_type} - ${row.document_number ?? "-"}`} />
                <Row label="ID expires" value={row.document_expires_at ?? "-"} />
                <Row label="Submitted" value={new Date(row.created_at).toLocaleString()} />
              </section>
              <section className="rounded-xl border border-border/70 bg-card/60 p-3">
                <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Government ID / passport</h4>
                {docs.isLoading && <p className="text-xs text-muted-foreground">Loading documents...</p>}
                <div className="grid gap-3">
                  {d?.document && <DocumentViewer src={d.document} alt={`${row.full_name} identity document`} />}
                  {d?.selfie && <DocumentViewer src={d.selfie} alt={`${row.full_name} ID holding photo`} />}
                </div>
                {d && !d.document && !d.selfie && <p className="text-xs text-muted-foreground">No files uploaded.</p>}
              </section>
              {row.admin_note && <p className="text-xs text-muted-foreground">Previous Level 1 note: {row.admin_note}</p>}
            </>
          ) : level2Status === "unsubmitted" ? (
            <p className="text-xs text-muted-foreground">Level 2 has not been submitted yet.</p>
          ) : (
            <>
              <section className="rounded-xl border border-border/70 bg-card/60 p-3">
                <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Enhanced risk assessment</h4>
                <Row label="Proof type" value={row.level2_proof_type ?? "-"} />
                <Row label="Tax ID" value={row.level2_tax_id ?? "-"} />
                <Row label="Submitted" value={row.level2_submitted_at ? new Date(row.level2_submitted_at).toLocaleString() : "-"} />
              </section>
              <section className="rounded-xl border border-border/70 bg-card/60 p-3">
                <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Biometric selfie / liveness & supporting proof</h4>
                <div className="grid gap-3">
                  {d?.level2Selfie && <DocumentViewer src={d.level2Selfie} alt={`${row.full_name} liveness selfie`} />}
                  {d?.level2Proof && <DocumentViewer src={d.level2Proof} alt={`${row.full_name} supporting proof`} />}
                </div>
              </section>
              {row.level2_admin_note && <p className="text-xs text-muted-foreground">Previous Level 2 note: {row.level2_admin_note}</p>}
            </>
          )}
        </div>

        {canReview && (
          <footer className="space-y-2 border-t border-border p-3">
            {rejecting ? (
              <>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Rejection code (required - sent to the user)</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {REJECTION_CODES.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => setCode(r.code)}
                      className={`touch-manipulation rounded-md border px-2 py-1.5 text-left text-[11px] font-semibold ${
                        code === r.code ? "border-ops-red bg-ops-red/10 text-ops-red" : "border-border text-muted-foreground"
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Audit reason (required)"
                  className="w-full rounded-md border border-border bg-background p-2 text-xs"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setRejecting(false)} className="flex-1 rounded-md border border-border px-3 py-2 text-xs">
                    Cancel
                  </button>
                  <button
                    disabled={!code || act.isPending || note.trim().length < 5}
                    onClick={() => act.mutate({ action: "reject" })}
                    className={`flex-1 ${DANGER_BTN} disabled:opacity-50`}
                  >
                    Confirm rejection
                  </button>
                </div>
              </>
            ) : (
              <div className="flex justify-end gap-2">
                <Button disabled={act.isPending} onClick={() => act.mutate({ action: "approve" })}>
                  {act.isPending && <Loader2 className="animate-spin" />}Approve KYC {tier === "L1" ? "Level 1" : "Level 2"}
                </Button>
                <button onClick={() => setRejecting(true)} className={`flex-1 ${DANGER_BTN}`}>
                  Reject Verification
                </button>
              </div>
            )}
          </footer>
        )}
      </aside>
    </div>
  );
}
