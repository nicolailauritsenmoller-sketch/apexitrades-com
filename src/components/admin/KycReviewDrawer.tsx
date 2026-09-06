import { APPROVE_BTN, DANGER_BTN } from "@/lib/admin-accents";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileCheck2, X } from "lucide-react";
import { toast } from "sonner";
import { getKycDocumentUrls, reviewKyc, reviewKycLevel2 } from "@/lib/admin.functions";

const REJECT_REASONS = [
  "Document is blurry or unreadable",
  "Document has expired",
  "Selfie does not match the document photo",
  "Name on document does not match the account",
  "Suspected forged or altered document",
  "Unsupported document type or country",
];

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/60 py-1.5 text-xs last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

/** Full-screen review panel: identity documents beside the applicant profile. */
export function KycReviewDrawer({
  row,
  onClose,
  onDone,
}: {
  row: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const fetchDocs = useServerFn(getKycDocumentUrls);
  const review = useServerFn(reviewKyc);
  const reviewL2 = useServerFn(reviewKycLevel2);
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [note, setNote] = useState("");

  const docs = useQuery({
    queryKey: ["admin-kyc-docs", row.id],
    queryFn: () => fetchDocs({ data: { id: row.id } }),
  });

  const act = useMutation({
    mutationFn: (vars: { action: "approve" | "reject"; note?: string }) =>
      review({ data: { id: row.id, action: vars.action, note: vars.note } }),
    onSuccess: (_r, vars) => {
      toast.success(vars.action === "approve" ? "KYC approved." : "KYC rejected.");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const actL2 = useMutation({
    mutationFn: (vars: { action: "approve" | "reject"; note?: string }) =>
      reviewL2({ data: { id: row.id, action: vars.action, note: vars.note } }),
    onSuccess: (_r, vars) => {
      toast.success(vars.action === "approve" ? "Level 2 approved." : "Level 2 rejected.");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const level2Status: string = row.level2_status ?? "unsubmitted";

  const d = docs.data as
    | {
        document: string | null;
        selfie: string | null;
        level2Selfie: string | null;
        level2Proof: string | null;
      }
    | undefined;

  return (
    <div className="fixed inset-0 z-[115] flex justify-end bg-black/60 backdrop-blur-sm">
      <button aria-label="Close" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-lg flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <FileCheck2 className="size-4 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">
              KYC review · {row.full_name}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {row.status}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ml-auto touch-manipulation rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <section className="rounded-xl border border-border/70 bg-card/60 p-3">
            <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Applicant
            </h4>
            <Row label="Legal name" value={row.full_name} />
            <Row label="Date of birth" value={row.date_of_birth} />
            <Row label="Country" value={row.country} />
            <Row label="Address" value={row.address} />
            <Row label="Document" value={`${row.document_type} · ${row.document_number ?? "—"}`} />
            <Row label="Expires" value={row.document_expires_at ?? "—"} />
            <Row label="Submitted" value={new Date(row.created_at).toLocaleString()} />
            <Row label="User ID" value={<span className="num">{String(row.user_id).slice(0, 8)}</span>} />
          </section>

          <section className="rounded-xl border border-border/70 bg-card/60 p-3">
            <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Uploaded documents
            </h4>
            {docs.isLoading && <p className="text-xs text-muted-foreground">Loading documents…</p>}
            {docs.isError && (
              <p className="text-xs text-bear">{(docs.error as Error)?.message ?? "Failed."}</p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {d?.document && (
                <a href={d.document} target="_blank" rel="noreferrer">
                  <img
                    src={d.document}
                    alt={`${row.full_name} identity document`}
                    className="w-full rounded-lg border border-border object-contain"
                  />
                </a>
              )}
              {d?.selfie && (
                <a href={d.selfie} target="_blank" rel="noreferrer">
                  <img
                    src={d.selfie}
                    alt={`${row.full_name} verification selfie`}
                    className="w-full rounded-lg border border-border object-contain"
                  />
                </a>
              )}
            </div>
            {d && !d.document && !d.selfie && (
              <p className="text-xs text-muted-foreground">No files uploaded.</p>
            )}
          </section>

          <section className="rounded-xl border border-border/70 bg-card/60 p-3">
            <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              Level 2 · enhanced verification · {level2Status}
            </h4>
            {level2Status === "unsubmitted" ? (
              <p className="text-xs text-muted-foreground">Not submitted yet.</p>
            ) : (
              <>
                <Row label="Proof type" value={row.level2_proof_type ?? "—"} />
                <Row label="Tax ID" value={row.level2_tax_id ?? "—"} />
                <Row
                  label="Submitted"
                  value={
                    row.level2_submitted_at
                      ? new Date(row.level2_submitted_at).toLocaleString()
                      : "—"
                  }
                />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {d?.level2Selfie && (
                    <a href={d.level2Selfie} target="_blank" rel="noreferrer">
                      <img
                        src={d.level2Selfie}
                        alt={`${row.full_name} liveness selfie`}
                        className="w-full rounded-lg border border-border object-contain"
                      />
                    </a>
                  )}
                  {d?.level2Proof && (
                    <a
                      href={d.level2Proof}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Open proof of address document
                    </a>
                  )}
                </div>
                {row.level2_admin_note && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Previous Level 2 note: {row.level2_admin_note}
                  </p>
                )}
                {level2Status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={actL2.isPending}
                      onClick={() => actL2.mutate({ action: "approve", note: note || undefined })}
                      className={`flex-1 ${APPROVE_BTN}`}
                    >
                      Approve Level 2
                    </button>
                    <button
                      disabled={actL2.isPending}
                      onClick={() =>
                        actL2.mutate({ action: "reject", note: note ? `${reason} — ${note}` : reason })
                      }
                      className={`flex-1 ${DANGER_BTN}`}
                    >
                      Reject Level 2
                    </button>
                  </div>
                )}
              </>
            )}
          </section>

          {row.admin_note && (
            <p className="text-xs text-muted-foreground">Previous note: {row.admin_note}</p>
          )}
        </div>

        {(row.status === "pending" || level2Status === "pending") && (
          <footer className="space-y-2 border-t border-border p-3">
            <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">
              Rejection reason (sent to the user)
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Additional note (optional)"
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            />
            <div className={`flex gap-2 ${row.status === "pending" ? "" : "hidden"}`}>
              <button
                disabled={act.isPending}
                onClick={() => act.mutate({ action: "approve", note: note || undefined })}
                className={`flex-1 ${APPROVE_BTN}`}
              >
                Approve KYC
              </button>
              <button
                disabled={act.isPending}
                onClick={() =>
                  act.mutate({ action: "reject", note: note ? `${reason} — ${note}` : reason })
                }
                className={`flex-1 ${DANGER_BTN}`}
              >
                Reject KYC
              </button>
            </div>
          </footer>
        )}
      </aside>
    </div>
  );
}
