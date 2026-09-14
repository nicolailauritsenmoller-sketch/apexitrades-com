import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { CertificateRecord } from "@/lib/certificates.server";
import {
  listCertificates,
  upsertCertificate,
  deleteCertificate,
} from "@/lib/certificates.functions";

const BADGES = ["iso", "soc2", "gdpr", "ssl", "custody"] as const;

type Draft = {
  id?: string;
  title: string;
  issuer: string;
  category: string;
  badgeKey: (typeof BADGES)[number];
  documentUrl: string;
  summary: string;
  issueDate: string;
  expiryDate: string;
  isActive: boolean;
  sortOrder: number;
};

const EMPTY: Draft = {
  title: "",
  issuer: "",
  category: "security",
  badgeKey: "iso",
  documentUrl: "",
  summary: "",
  issueDate: "",
  expiryDate: "",
  isActive: true,
  sortOrder: 0,
};

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40";

/** Admin "Security & Compliance" management for public trust certificates. */
export function CertificatesPanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listCertificates);
  const save = useServerFn(upsertCertificate);
  const remove = useServerFn(deleteCertificate);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [uploading, setUploading] = useState(false);

  const list = useQuery({
    queryKey: ["admin-certificates"],
    queryFn: async () => (await fetchAll()) as CertificateRecord[],
  });

  const saveMutation = useMutation({
    mutationFn: (d: Draft) =>
      save({
        data: {
          id: d.id,
          title: d.title,
          issuer: d.issuer,
          category: d.category,
          badgeKey: d.badgeKey,
          documentUrl: d.documentUrl || null,
          summary: d.summary,
          issueDate: d.issueDate || null,
          expiryDate: d.expiryDate || null,
          isActive: d.isActive,
          sortOrder: Number(d.sortOrder) || 0,
        },
      }),
    onSuccess: () => {
      toast.success("Certificate saved");
      setDraft(EMPTY);
      void qc.invalidateQueries({ queryKey: ["admin-certificates"] });
      void qc.invalidateQueries({ queryKey: ["public-certificates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Certificate removed");
      void qc.invalidateQueries({ queryKey: ["admin-certificates"] });
      void qc.invalidateQueries({ queryKey: ["public-certificates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadDoc(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be 10MB or smaller.");
      return;
    }
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("certificates").upload(path, file);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDraft((d) => ({ ...d, documentUrl: path }));
    toast.success("Document uploaded");
  }

  return (
    <section className="rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      <h3 className="font-display text-base font-bold">Security &amp; Compliance</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Certificates rendered on the public landing page and footer badges.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input
          className={field}
          placeholder="Title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <input
          className={field}
          placeholder="Issuer"
          value={draft.issuer}
          onChange={(e) => setDraft({ ...draft, issuer: e.target.value })}
        />
        <select
          className={field}
          value={draft.badgeKey}
          onChange={(e) => setDraft({ ...draft, badgeKey: e.target.value as Draft["badgeKey"] })}
        >
          {BADGES.map((b) => (
            <option key={b} value={b}>
              {b.toUpperCase()} badge
            </option>
          ))}
        </select>
        <input
          className={field}
          placeholder="Category"
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
        <label className="text-xs text-muted-foreground">
          Issue date
          <input
            type="date"
            className={field}
            value={draft.issueDate}
            onChange={(e) => setDraft({ ...draft, issueDate: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Expiry date
          <input
            type="date"
            className={field}
            value={draft.expiryDate}
            onChange={(e) => setDraft({ ...draft, expiryDate: e.target.value })}
          />
        </label>
        <textarea
          className={`${field} md:col-span-2`}
          rows={2}
          placeholder="One-sentence explanation shown in the badge tooltip"
          value={draft.summary}
          onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
        />
        <div className="flex items-center gap-3 md:col-span-2">
          <label className="inline-flex cursor-pointer touch-manipulation items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <Upload className="size-4" />
            {uploading ? "Uploading…" : "Upload document (PDF/Image)"}
            <input
              type="file"
              accept="application/pdf,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadDoc(f);
              }}
            />
          </label>
          {draft.documentUrl ? (
            <span className="inline-flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <FileText className="size-3.5" />
              {draft.documentUrl}
            </span>
          ) : null}
          <label className="ml-auto inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Active
          </label>
          <button
            type="button"
            disabled={saveMutation.isPending || draft.title.trim().length < 2}
            onClick={() => saveMutation.mutate(draft)}
            className="inline-flex touch-manipulation items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="size-4" />
            {draft.id ? "Update" : "Add"}
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {(list.data ?? []).map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{c.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {c.issuer || "—"} · {c.isActive ? "Active" : "Hidden"}
                {c.expiryDate ? ` · expires ${c.expiryDate}` : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={() =>
                setDraft({
                  id: c.id,
                  title: c.title,
                  issuer: c.issuer,
                  category: c.category,
                  badgeKey: (c.badgeKey as Draft["badgeKey"]) ?? "iso",
                  documentUrl: c.documentUrl ?? "",
                  summary: c.summary,
                  issueDate: c.issueDate ?? "",
                  expiryDate: c.expiryDate ?? "",
                  isActive: c.isActive,
                  sortOrder: c.sortOrder,
                })
              }
              className="rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => deleteMutation.mutate(c.id)}
              className="rounded-md border border-ops-red/25 px-2 py-1.5 text-ops-red"
              aria-label={`Delete ${c.title}`}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {list.data && list.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No certificates yet.</p>
        ) : null}
      </div>
    </section>
  );
}
