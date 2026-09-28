import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Paperclip, ShieldAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { SECURITY_CATEGORIES, SECURITY_SEVERITIES } from "@/lib/vip";
import { institutionalizeCopy } from "@/lib/institutional-copy";
import {
  createSecurityReport,
  listMySecurityReports,
} from "@/lib/security-reports.functions";

const STATUS_TONE: Record<string, string> = {
  open: "text-warning",
  investigating: "text-primary",
  resolved: "text-bull",
  dismissed: "text-muted-foreground",
};

/** In-app overlay for reporting a security issue - never leaves the platform. */
export function SecurityReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<string>("account_takeover");
  const [severity, setSeverity] = useState<string>("medium");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const create = useServerFn(createSecurityReport);
  const fetchMine = useServerFn(listMySecurityReports);

  const mine = useQuery({
    queryKey: ["my-security-reports"],
    queryFn: () => fetchMine(),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: async () => {
      let attachmentPath: string | null = null;
      let attachmentName: string | null = null;
      if (file) {
        setUploading(true);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Please sign in again.");
        const path = `${uid}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const { error } = await supabase.storage.from("security-reports").upload(path, file);
        setUploading(false);
        if (error) throw new Error(error.message);
        attachmentPath = path;
        attachmentName = file.name;
      }
      return create({
        data: {
          category: category as any,
          severity: severity as any,
          description,
          attachmentPath,
          attachmentName,
        },
      });
    },
    onSuccess: () => {
      toast.success("Report sent to our security team.");
      setDescription("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["my-security-reports"] });
    },
    onError: (e: Error) => {
      setUploading(false);
      toast.error(e.message);
    },
  });

  const busy = submit.isPending || uploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-bear" /> Report a security issue
          </DialogTitle>
          <DialogDescription>
            Sent straight to our internal security desk. We never ask for passwords or 2FA codes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Issue category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {SECURITY_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">Severity</span>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {SECURITY_SEVERITIES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={4000}
              placeholder="What happened, when, and what you observed…"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf,text/plain"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              <Paperclip className="size-4" /> Attach evidence
            </button>
            {file && <span className="truncate text-xs text-muted-foreground">{file.name}</span>}
            <button
              onClick={() => submit.mutate()}
              disabled={busy || description.trim().length < 10}
              className="ml-auto inline-flex items-center gap-2 rounded-md bg-bear px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy && <Loader2 className="size-4 animate-spin" />} Submit report
            </button>
          </div>

          <div className="rounded-lg border border-border">
            <header className="border-b border-border px-3 py-2 text-xs font-semibold">
              My reports
            </header>
            <div className="max-h-52 divide-y divide-border overflow-y-auto">
              {(mine.data ?? []).length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  No reports submitted yet.
                </p>
              ) : (
                (mine.data ?? []).map((r: any) => (
                  <div key={r.id} className="space-y-1 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">
                        {SECURITY_CATEGORIES.find((c) => c.id === r.category)?.label ?? r.category}
                      </span>
                      <span className={`uppercase ${STATUS_TONE[r.status] ?? ""}`}>{r.status}</span>
                    </div>
                    <p className="line-clamp-2 text-muted-foreground">{r.description}</p>
                     {r.adminNote && <p className="text-primary">Security Operations: {institutionalizeCopy(r.adminNote)}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
