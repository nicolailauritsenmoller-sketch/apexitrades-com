import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  addTicketMessage,
  createSupportTicket,
  listMyTickets,
} from "@/lib/support.functions";

const STATUS_TONE: Record<string, string> = {
  open: "text-warning",
  pending: "text-primary",
  resolved: "text-bull",
};

export function TicketDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [priority, setPriority] = useState<string>("normal");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [reply, setReply] = useState("");

  const fetchTickets = useServerFn(listMyTickets);
  const create = useServerFn(createSupportTicket);
  const addMessage = useServerFn(addTicketMessage);

  const query = useQuery({
    queryKey: ["my-tickets"],
    queryFn: () => fetchTickets(),
    enabled: open,
  });

  const submit = useMutation({
    mutationFn: () =>
      create({ data: { subject, body, category: category as any, priority: priority as any } }),
    onSuccess: () => {
      toast.success("Ticket submitted — our team will reply shortly.");
      setSubject("");
      setBody("");
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

  const tickets = ((query.data as any)?.tickets ?? []) as any[];
  const messages = ((query.data as any)?.messages ?? []) as any[];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit a support ticket</DialogTitle>
          <DialogDescription>
            Our support desk replies inside your dashboard — no email round trips.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={140}
            className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              Category
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Priority
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Describe your issue…"
            className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending || subject.trim().length < 4 || body.trim().length < 5}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submit.isPending ? "Submitting…" : "Submit ticket"}
          </button>
        </div>

        <div className="mt-2 border-t border-border pt-3">
          <p className="mb-2 text-sm font-semibold">Your tickets</p>
          {tickets.length === 0 && (
            <p className="text-xs text-muted-foreground">No tickets yet.</p>
          )}
          <ul className="space-y-2">
            {tickets.map((t) => (
              <li key={t.id} className="rounded-md border border-border p-3">
                <button
                  onClick={() => setActiveId(activeId === t.id ? null : t.id)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{t.subject}</span>
                    <span className="block text-[11px] capitalize text-muted-foreground">
                      {t.category} · {t.priority} · {new Date(t.created_at).toLocaleDateString()}
                    </span>
                  </span>
                  <span className={`shrink-0 text-xs capitalize ${STATUS_TONE[t.status] ?? ""}`}>
                    {t.status}
                  </span>
                </button>

                {activeId === t.id && (
                  <div className="mt-3 space-y-2">
                    {messages
                      .filter((m) => m.ticket_id === t.id)
                      .map((m) => (
                        <div
                          key={m.id}
                          className={`rounded-md px-3 py-2 text-xs ${
                            m.sender_role === "user"
                              ? "bg-secondary"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <span className="mb-0.5 block text-[10px] uppercase opacity-70">
                            {m.sender_role === "user" ? "You" : "Support agent"}
                          </span>
                          {m.body}
                        </div>
                      ))}
                    <div className="flex gap-2">
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Add a reply…"
                        maxLength={2000}
                        className="flex-1 rounded-md bg-secondary px-3 py-2 text-xs outline-none"
                      />
                      <button
                        onClick={() => reply.trim() && respond.mutate({ ticketId: t.id, body: reply.trim() })}
                        disabled={respond.isPending}
                        className="rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground disabled:opacity-50"
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
      </DialogContent>
    </Dialog>
  );
}
