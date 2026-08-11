import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { UidTag } from "@/components/VerifiedBadge";
import { SECURITY_CATEGORIES, SECURITY_STATUSES } from "@/lib/vip";
import {
  getSecurityAttachmentUrl,
  listSecurityReports,
  reviewSecurityReport,
} from "@/lib/security-reports.functions";

const SEVERITY_TONE: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-warning",
  high: "text-bear",
  critical: "text-bear font-bold",
};

/** Staff inbox for in-app security reports. */
export function SecurityReportsPanel() {
  const qc = useQueryClient();
  const fetchReports = useServerFn(listSecurityReports);
  const review = useServerFn(reviewSecurityReport);
  const attachment = useServerFn(getSecurityAttachmentUrl);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const reports = useQuery({ queryKey: ["security-reports"], queryFn: () => fetchReports() });

  const mutation = useMutation({
    mutationFn: (v: { id: string; status: string; adminNote?: string }) =>
      review({ data: { ...v, status: v.status as any, notifyUser: true } }),
    onSuccess: () => {
      toast.success("Report updated — reporter notified.");
      qc.invalidateQueries({ queryKey: ["security-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openAttachment = async (id: string) => {
    const res = (await attachment({ data: { id } })) as { url: string | null };
    if (res.url) window.open(res.url, "_blank", "noopener");
    else toast.error("No attachment on this report.");
  };

  const rows = reports.data ?? [];

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center gap-2 border-b border-border px-4 py-3">
        <ShieldAlert className="size-4 text-bear" />
        <h2 className="font-display text-sm font-semibold tracking-tight">Security reports</h2>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} total</span>
      </header>

      <div className="divide-y divide-border">
        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No reports filed.</p>
        )}
        {rows.map((r: any) => (
          <article key={r.id} className="space-y-2 p-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{r.userName}</span>
              <UidTag uid={r.userUid} className="text-muted-foreground" />
              <span className={`text-xs uppercase ${SEVERITY_TONE[r.severity] ?? ""}`}>
                {r.severity}
              </span>
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest">
                {SECURITY_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()}
              </span>
            </div>

            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{r.description}</p>

            {r.attachmentName && (
              <button
                onClick={() => openAttachment(r.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary"
              >
                <ExternalLink className="size-3" /> {r.attachmentName}
              </button>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <input
                value={notes[r.id] ?? r.adminNote ?? ""}
                onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                placeholder="Response to the reporter…"
                className="min-w-48 flex-1 rounded-md bg-secondary px-3 py-1.5 text-xs outline-none"
              />
              {SECURITY_STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    mutation.mutate({ id: r.id, status: s, adminNote: notes[r.id] ?? r.adminNote })
                  }
                  disabled={mutation.isPending}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-semibold ${
                    r.status === s
                      ? "bg-primary text-primary-foreground"
                      : "border border-border hover:bg-secondary"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
