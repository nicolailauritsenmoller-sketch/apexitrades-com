import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Paperclip, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  TICKET_CATEGORIES,
  TICKET_STATUS_LABELS,
  addTicketMessage,
  createSupportTicket,
  getSupportIdentity,
  listMyTickets,
} from "@/lib/support.functions";

const STATUS_TONE: Record<string, string> = {
  open: "border-warning/40 bg-warning/10 text-warning",
  in_progress: "border-primary/40 bg-primary/10 text-primary",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  waiting_customer: "border-amber-500/40 bg-amber-500/10 text-amber-600",
  resolved: "border-bull/40 bg-bull/10 text-bull",
  closed: "border-border bg-secondary text-muted-foreground",
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "application/pdf"];

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        STATUS_TONE[status] ?? "border-border bg-secondary text-muted-foreground",
      )}
    >
      {TICKET_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Ticket files live in `support-attachments`; older threads still point at `chat-attachments`. */
async function openAttachment(path: string) {
  for (const bucket of ["support-attachments", "chat-attachments"]) {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank", "noopener");
      return;
    }
  }
  toast.error("Attachment unavailable.");
}

export function TicketDialog({
  open,
  onOpenChange,
  defaultTab = "submit",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultTab?: "submit" | "tickets";
}) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"submit" | "tickets">(defaultTab);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("account");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ reference: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchTickets = useServerFn(listMyTickets);
  const fetchIdentity = useServerFn(getSupportIdentity);
  const create = useServerFn(createSupportTicket);
  const addMessage = useServerFn(addTicketMessage);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [open, defaultTab]);

  const identity = useQuery({
    queryKey: ["support-identity"],
    queryFn: () => fetchIdentity(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const d = identity.data as { fullName?: string; email?: string } | undefined;
    if (!d) return;
    setFullName((v) => v || (d.fullName ?? ""));
    setEmail((v) => v || (d.email ?? ""));
  }, [identity.data]);

  const query = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => fetchTickets(),
    enabled: open,
  });

  const uploadIfNeeded = async () => {
    if (!file) return undefined;
    setUploading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Session expired.");
      const path = `${user.user.id}/tickets/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("support-attachments").upload(path, file);
      if (error) throw new Error(error.message);
      return { path, name: file.name, type: file.type };
    } finally {
      setUploading(false);
    }
  };

  const submit = useMutation({
    mutationFn: async () => {
      const uploaded = await uploadIfNeeded();
      return create({
        data: {
          subject: subject.trim(),
          body: body.trim(),
          category: category as any,
          priority: "normal",
          fullName: fullName.trim(),
          email: email.trim(),
          attachment: uploaded,
        },
      });
    },
    onSuccess: (ticket: any) => {
      setCreated({ reference: ticket?.reference ?? "VT-PENDING" });
      setSubject("");
      setBody("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: (v: { ticketId: string; body: string }) => addMessage({ data: v }),
    onSuccess: () => {
      setReply("");
      qc.invalidateQueries({ queryKey: ["my-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const validateAndSubmit = () => {
    const next: Record<string, string> = {};
    if (fullName.trim().length < 2) next['fullName'] = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next['email'] = "Enter a valid email address.";
    if (subject.trim().length < 4) next['subject'] = "Add a short subject (4+ characters).";
    if (body.trim().length < 5) next['body'] = "Describe your issue in a little more detail.";
    if (file) {
      if (file.size > MAX_BYTES) next['file'] = "Attachment must be 5MB or smaller.";
      else if (!ACCEPTED.includes(file.type)) next['file'] = "Only JPG, PNG or PDF files are supported.";
    }
    setErrors(next);
    if (Object.keys(next).length === 0) submit.mutate();
  };

  const tickets = ((query.data as any)?.tickets ?? []) as any[];
  const messages = ((query.data as any)?.messages ?? []) as any[];
  const busy = submit.isPending || uploading;

  const activeMessages = useMemo(
    () => messages.filter((m) => m.ticket_id === activeId),
    [messages, activeId],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl touch-manipulation overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Support requests</DialogTitle>
          <DialogDescription>
            Submit a request or continue an existing conversation — replies arrive in your support inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-xl bg-secondary p-1 text-sm">
          {(
            [
              ["submit", "Submit request"],
              ["tickets", "Support tickets"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "min-h-9 flex-1 touch-manipulation rounded-lg px-3 text-xs font-semibold transition-colors",
                tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "submit" &&
          (created ? (
            <div className="space-y-4 rounded-xl border border-bull/30 bg-bull/5 p-5 text-center">
              <CheckCircle2 className="mx-auto size-10 text-bull" />
              <div>
                <p className="text-sm font-semibold">Request submitted successfully.</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ticket <span className="font-mono font-semibold text-foreground">#{created.reference}</span> created.
                  Our team will respond through your Support Inbox.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setCreated(null);
                    setTab("tickets");
                  }}
                  className="min-h-10 touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  View support tickets
                </button>
                <button
                  type="button"
                  onClick={() => setCreated(null)}
                  className="min-h-10 touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold"
                >
                  Submit another
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Field label="Full name" error={errors['fullName']}>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                  className="input-base"
                />
              </Field>
              <Field label="Email address" error={errors['email']}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  maxLength={255}
                  className="input-base"
                />
              </Field>
              <Field label="Reason for contact">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="input-base"
                >
                  {TICKET_CATEGORIES.filter((c) => c.id !== "general").map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Subject" error={errors['subject']}>
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={140}
                  placeholder="Short summary"
                  className="input-base"
                />
              </Field>
              <Field label="Describe your issue" error={errors['body']}>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Include amounts, currencies and timestamps where relevant."
                  className="input-base"
                />
              </Field>

              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex min-h-10 touch-manipulation items-center gap-2 rounded-xl border border-border px-3 text-xs font-semibold"
                  >
                    <Paperclip className="size-3.5" /> Attach file
                  </button>
                  {file && (
                    <span className="flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs">
                      <span className="max-w-40 truncate">{file.name}</span>
                      <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment">
                        <X className="size-3" />
                      </button>
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">Optional · max 5MB · JPG, PNG or PDF</p>
                {errors['file'] && <p className="mt-1 text-[11px] text-destructive">{errors['file']}</p>}
              </div>

              <button
                type="button"
                onClick={validateAndSubmit}
                disabled={busy}
                className="flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />}
                {busy ? "Submitting…" : "Submit request"}
              </button>
            </div>
          ))}

        {tab === "tickets" && (
          <div className="space-y-2">
            {query.isLoading && <p className="text-xs text-muted-foreground">Loading tickets…</p>}
            {!query.isLoading && tickets.length === 0 && (
              <p className="text-xs text-muted-foreground">No support requests yet.</p>
            )}
            <ul className="space-y-2">
              {tickets.map((t) => (
                <li key={t.id} className="rounded-xl border border-border p-3">
                  <button
                    type="button"
                    onClick={() => setActiveId(activeId === t.id ? null : t.id)}
                    className="flex w-full touch-manipulation items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{t.subject}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {t.reference ? `#${t.reference} · ` : ""}
                        {TICKET_CATEGORIES.find((c) => c.id === t.category)?.label ?? t.category} ·{" "}
                        {new Date(t.created_at).toLocaleDateString()}
                      </span>
                    </span>
                    <StatusBadge status={t.status} />
                  </button>

                  {activeId === t.id && (
                    <div className="mt-3 space-y-2">
                      {activeMessages.map((m) => (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-lg px-3 py-2 text-xs",
                            m.sender_role === "user" ? "bg-secondary" : "bg-primary/10 text-primary",
                          )}
                        >
                          <span className="mb-0.5 block text-[10px] uppercase opacity-70">
                            {m.sender_role === "user" ? "You" : "Support agent"}
                          </span>
                          <span className="whitespace-pre-wrap">{m.body}</span>
                          {m.attachment_path && (
                            <button
                              type="button"
                              onClick={() => openAttachment(m.attachment_path)}
                              className="mt-1 flex items-center gap-1 text-[11px] underline"
                            >
                              <Paperclip className="size-3" />
                              {m.attachment_name ?? "Attachment"}
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <input
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Add a reply…"
                          maxLength={2000}
                          className="min-h-10 flex-1 rounded-lg bg-secondary px-3 text-xs outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => reply.trim() && respond.mutate({ ticketId: t.id, body: reply.trim() })}
                          disabled={respond.isPending}
                          className="min-h-10 touch-manipulation rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-[11px] font-normal text-destructive">{error}</p>}
    </label>
  );
}
