import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getMyKyc } from "@/lib/kyc.functions";
import { KYC_LABEL, KYC_TONE } from "@/components/profile/ui";

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

export function KycPanel({
  kyc,
  userId,
  needsResubmit,
  onSubmit,
}: {
  kyc: KycData;
  userId: string | null;
  needsResubmit: boolean;
  onSubmit: (payload: {
    fullName: string;
    dateOfBirth: string;
    country: string;
    address: string;
    documentType: "passport" | "id_card" | "drivers_license";
    documentNumber: string;
    documentPath: string;
    selfiePath: string;
    documentExpiresAt?: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    country: "",
    address: "",
    documentType: "passport" as "passport" | "id_card" | "drivers_license",
    documentNumber: "",
    documentExpiresAt: "",
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const showForm = open || !kyc || needsResubmit;

  async function upload(file: File, kind: string) {
    const path = `${userId}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!docFile || !selfieFile) {
      toast.error("Upload both your document and a selfie.");
      return;
    }
    setBusy(true);
    try {
      const [documentPath, selfiePath] = await Promise.all([
        upload(docFile, "document"),
        upload(selfieFile, "selfie"),
      ]);
      await onSubmit({
        ...form,
        documentPath,
        selfiePath,
        documentExpiresAt: form.documentExpiresAt || undefined,
      });
      setOpen(false);
      setDocFile(null);
      setSelfieFile(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {kyc && (
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{kyc.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {kyc.documentType.replace("_", " ")} · {kyc.country} · submitted{" "}
                {new Date(kyc.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[kyc.status]}`}
            >
              {KYC_LABEL[kyc.status] ?? kyc.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Document expiry:{" "}
            {kyc.documentExpiresAt
              ? new Date(kyc.documentExpiresAt).toLocaleDateString()
              : "not provided"}
            {kyc.expired && <span className="ml-2 text-bear">Expired</span>}
          </p>
          {kyc.adminNote && (
            <p className="mt-1 text-xs text-amber-400">Reviewer note: {kyc.adminNote}</p>
          )}
          <div className="mt-3 flex gap-3 text-xs">
            {kyc.documentUrl && (
              <a
                href={kyc.documentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                View document
              </a>
            )}
            {kyc.selfieUrl && (
              <a
                href={kyc.selfieUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                View selfie
              </a>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 touch-manipulation rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Re-submit documents
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Full legal name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Residential address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.documentType}
            onChange={(e) =>
              setForm({ ...form, documentType: e.target.value as typeof form.documentType })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="passport">Passport</option>
            <option value="id_card">Government ID card</option>
            <option value="drivers_license">Driver's license</option>
          </select>
          <input
            required
            placeholder="Document number"
            value={form.documentNumber}
            onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="text-xs text-muted-foreground">
            Document expiry date
            <input
              type="date"
              value={form.documentExpiresAt}
              onChange={(e) => setForm({ ...form, documentExpiresAt: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <label className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Government ID / passport / licence
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              {docFile && <span className="mt-1 block text-foreground">{docFile.name}</span>}
            </label>
            <label className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Live selfie photo
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              {selfieFile && <span className="mt-1 block text-foreground">{selfieFile.name}</span>}
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      )}
    </div>
  );
}
