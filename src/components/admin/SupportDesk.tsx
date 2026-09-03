import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  CheckCircle2,
  Inbox,
  Loader2,
  Paperclip,
  Send,
  Ticket,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { markThreadRead, sendAgentChat } from "@/lib/desk.functions";
import { setActiveChatSession, silenceChatAlerts } from "@/lib/alerts";

import {
  getSupportThreads,
  getSupportTickets,
  getThreadMessages,
  markTicketRead,
  replyToTicket,
  setThreadStatus,
  updateTicketStatus,
} from "@/lib/admin.functions";

const STATUS_FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "open", label: "Open", match: (s: string) => s === "open" || s === "in_progress" },
  {
    id: "pending",
    label: "Pending agent",
    match: (s: string) => s === "pending" || s === "waiting_customer",
  },
  { id: "resolved", label: "Resolved", match: (s: string) => s === "resolved" || s === "closed" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

/** Full lifecycle exposed to agents in the workspace. */
const TICKET_STATE_OPTIONS = [
  { id: "open", label: "Open" },
  { id: "in_progress", label: "In Progress" },
  { id: "waiting_customer", label: "Waiting for Customer" },
  { id: "resolved", label: "Resolved" },
  { id: "closed", label: "Closed" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  pending: "Waiting for Customer",
  waiting_customer: "Waiting for Customer",
  resolved: "Resolved",
  closed: "Closed",
};

const PRIORITY_TONE: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-foreground",
  high: "text-warning",
  urgent: "text-bear",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  waiting_customer: "bg-warning/10 text-warning",
  resolved: "bg-bull/10 text-bull",
  closed: "bg-secondary text-muted-foreground",
};

export function SupportDesk({ initialView = "inbox" }: { initialView?: "inbox" | "tickets" }) {
  const [view, setView] = useState<"inbox" | "tickets">(initialView);
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {(
          [
            { id: "inbox", label: "Live chat inboxes", icon: Inbox },
            { id: "tickets", label: "Support tickets", icon: Ticket },
          ] as const
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              view === id
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>
      {view === "inbox" ? <ChatInboxes /> : <TicketsDesk />}
    </div>
  );
}

/* ----------------------------- live chat ----------------------------- */

function ChatInboxes() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchThreads = useServerFn(getSupportThreads);
  const fetchMessages = useServerFn(getThreadMessages);
  const send = useServerFn(sendAgentChat);
  const markRead = useServerFn(markThreadRead);
  const setStatus = useServerFn(setThreadStatus);

  const threads = useQuery({
    queryKey: ["support-threads"],
    queryFn: () => fetchThreads(),
    refetchInterval: 15_000,
  });

  const messages = useQuery({
    queryKey: ["support-thread", activeId],
    queryFn: () => fetchMessages({ data: { sessionId: activeId! } }),
    enabled: !!activeId,
    refetchInterval: 8_000,
  });

  // Opening the desk (or switching threads) hard-mutes the looping bell and
  // clears unread ticks for the selected conversation.
  useEffect(() => {
    setActiveChatSession(activeId);
    silenceChatAlerts();
    return () => setActiveChatSession(null);
  }, [activeId]);

  useEffect(() => {
    silenceChatAlerts();
    if (!activeId) return;
    void markRead({ data: { sessionId: activeId } }).then(() => {
      qc.invalidateQueries({ queryKey: ["support-threads"] });
      qc.invalidateQueries({ queryKey: ["desk-unread"] });
      silenceChatAlerts();
    });
  }, [activeId, markRead, qc]);

  // Any new message that lands while the thread is open counts as seen.
  useEffect(() => {
    if (!activeId || !messages.data) return;
    silenceChatAlerts();
    void markRead({ data: { sessionId: activeId } }).then(() => {
      qc.invalidateQueries({ queryKey: ["support-threads"] });
      qc.invalidateQueries({ queryKey: ["desk-unread"] });
    });
  }, [messages.data, activeId, markRead, qc]);

  // Mute as soon as the live message bubbles actually enter the viewport.
  useEffect(() => {
    const node = endRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) silenceChatAlerts();
      },
      { threshold: 0.1 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [activeId]);


  // Real-time push for the thread currently open in the right panel, with
  // automatic re-subscription and resync whenever the socket drops.
  useEffect(() => {
    if (!activeId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const resync = () => {
      qc.invalidateQueries({ queryKey: ["support-thread", activeId] });
      qc.invalidateQueries({ queryKey: ["support-threads"] });
    };

    function subscribe() {
      channel = supabase
        .channel(`admin-chat-${activeId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `session_id=eq.${activeId}`,
          },
          resync,
        )
        .subscribe((status) => {
          if (!alive) return;
          if (status === "SUBSCRIBED") resync();
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            retry = setTimeout(subscribe, 1200);
          }
        });
    }
    subscribe();

    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);
    return () => {
      alive = false;
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
      if (channel) supabase.removeChannel(channel);
    };
  }, [activeId, qc]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.data]);

  const reply = useMutation({
    mutationFn: async (body: string) => {
      let attachment: {
        attachmentPath?: string;
        attachmentName?: string;
        attachmentType?: string;
      } = {};
      if (file) {
        setUploading(true);
        const { data: me } = await supabase.auth.getUser();
        const path = `${me.user?.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
        setUploading(false);
        if (error) throw new Error(error.message);
        attachment = {
          attachmentPath: path,
          attachmentName: file.name,
          attachmentType: file.type,
        };
      }
      return send({ data: { sessionId: activeId!, body, ...attachment } });
    },
    onMutate: (body: string) => {
      // Optimistic bubble so the agent sees their reply instantly.
      setDraft("");
      const optimistic = {
        id: `pending-${crypto.randomUUID()}`,
        session_id: activeId,
        sender_role: "agent",
        body,
        created_at: new Date().toISOString(),
        read_at: null,
        pending: true,
      };
      qc.setQueryData(["support-thread", activeId], (old: any) => [...(old ?? []), optimistic]);
      return { optimisticId: optimistic.id };
    },
    onSuccess: () => {
      setDraft("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["support-thread", activeId] });
      qc.invalidateQueries({ queryKey: ["support-threads"] });
    },
    onError: (e: Error, body, ctx) => {
      // Roll the optimistic bubble back and hand the draft back to the agent.
      qc.setQueryData(["support-thread", activeId], (old: any) =>
        (old ?? []).filter((m: any) => m.id !== ctx?.optimisticId),
      );
      setDraft(body);
      toast.error(e.message);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: (status: "open" | "closed") =>
      setStatus({ data: { sessionId: activeId!, status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["support-threads"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (threads.data ?? []) as any[];
  const active = list.find((t) => t.id === activeId) ?? null;

  return (
    <div className="grid gap-3 overflow-hidden rounded-lg border border-border bg-card md:h-[32rem] md:grid-cols-[18rem_1fr]">
      <div className="max-h-72 overflow-y-auto border-border md:max-h-none md:border-r">
        {threads.isLoading && <p className="p-4 text-xs text-muted-foreground">Loading inboxes…</p>}
        {!threads.isLoading && list.length === 0 && (
          <p className="p-4 text-xs text-muted-foreground">No conversations yet.</p>
        )}
        {list.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              silenceChatAlerts();
              setActiveId(t.id);
            }}

            className={`flex w-full items-start gap-2 border-b border-border px-3 py-3 text-left transition-colors ${
              activeId === t.id ? "bg-secondary" : "hover:bg-secondary/60"
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{t.legalName ?? t.displayName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                UID {t.uid ?? t.userId.slice(0, 8)} · {t.kycStatus}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {t.preview ?? "No messages"}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-[10px] text-muted-foreground">
                {new Date(t.lastMessageAt).toLocaleDateString()}
              </span>
              {t.unread > 0 && (
                <span className="grid min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                  {t.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="flex min-h-[24rem] flex-col">
        {!active ? (
          <p className="m-auto text-sm text-muted-foreground">Select a conversation to reply.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {active.legalName ?? active.displayName}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  User ID {active.userId}
                </p>
              </div>
              <button
                onClick={() => toggleStatus.mutate(active.status === "open" ? "closed" : "open")}
                className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {active.status === "open" ? "Close thread" : "Reopen"}
              </button>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {((messages.data ?? []) as any[]).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.sender_role === "user"
                      ? "bg-secondary text-foreground"
                      : "ml-auto bg-primary text-primary-foreground"
                  }`}
                >
                  {m.body}
                  {m.attachment_path && (
                    <ChatAttachment
                      messageId={m.id}
                      name={m.attachment_name}
                      type={m.attachment_type}
                    />
                  )}
                  <span className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleString()}
                    {m.sender_role !== "user" &&
                      (m.read_at ? (
                        <CheckCheck className="size-3" />
                      ) : (
                        <Check className="size-3" />
                      ))}
                  </span>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border p-2">
              {file && (
                <span className="flex w-full items-center gap-2 rounded-md bg-secondary px-2 py-1 text-[11px]">
                  <Paperclip className="size-3" />
                  <span className="truncate">{file.name}</span>
                  <button onClick={() => setFile(null)} aria-label="Remove attachment">
                    <X className="size-3" />
                  </button>
                </span>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                onClick={() => fileRef.current?.click()}
                aria-label="Attach a file"
                className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                <Paperclip className="size-4" />
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (draft.trim() || file) && reply.mutate(draft.trim())
                }
                placeholder="Reply as support agent…"
                maxLength={2000}
                className="flex-1 rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => (draft.trim() || file) && reply.mutate(draft.trim())}
                disabled={reply.isPending || uploading}
                aria-label="Send reply"
                className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              >
                {reply.isPending || uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ tickets ------------------------------ */

function TicketsDesk() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const fetchTickets = useServerFn(getSupportTickets);
  const setStatus = useServerFn(updateTicketStatus);
  const reply = useServerFn(replyToTicket);
  const markRead = useServerFn(markTicketRead);

  const query = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => fetchTickets(),
    refetchInterval: 20_000,
  });

  // Opening a ticket clears its unread indicator in the database.
  useEffect(() => {
    if (!activeId) return;
    void markRead({ data: { ticketId: activeId } }).then(() => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["desk-unread"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    });
  }, [activeId, markRead, qc]);

  const statusMutation = useMutation({
    mutationFn: (v: { ticketId: string; status: string }) =>
      setStatus({ data: v }),
    onSuccess: async () => {
      toast.success("Ticket updated");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["desk-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: (v: { ticketId: string; body: string }) => reply({ data: v }),
    onSuccess: async () => {
      setDraft("");
      toast.success("Reply sent to the trader's dashboard");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tickets = ((query.data as any)?.tickets ?? []) as any[];
  const messages = ((query.data as any)?.messages ?? []) as any[];
  const filtered = useMemo(() => {
    const rule = STATUS_FILTERS.find((f) => f.id === filter)!;
    return tickets.filter((t) => rule.match(t.status));
  }, [tickets, filter]);
  const active = tickets.find((t) => t.id === activeId) ?? null;


  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === f.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label} ({tickets.filter((t) => f.match(t.status)).length})
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Reference</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Trader</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => setActiveId(t.id)}
                  className={`cursor-pointer border-b border-border/60 ${
                    activeId === t.id ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-muted-foreground">
                    {t.reference ?? "—"}
                  </td>
                  <td className="max-w-[16rem] px-3 py-2">
                    <span className="flex items-center gap-2">
                      {t.unread > 0 && (
                        <span className="size-2 shrink-0 rounded-full bg-bear" aria-label="Unread" />
                      )}
                      <span
                        className={`truncate ${t.unread > 0 ? "font-semibold text-foreground" : ""}`}
                      >
                        {t.subject}
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block truncate text-xs">{t.legalName ?? t.displayName}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {t.email ?? t.uid ?? t.user_id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{t.category}</td>
                  <td className={`px-3 py-2 text-xs capitalize ${PRIORITY_TONE[t.priority] ?? ""}`}>
                    {t.priority}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_TONE[t.status] ?? ""}`}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <select
                      value={t.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        statusMutation.mutate({ ticketId: t.id, status: e.target.value as any })
                      }
                      className="rounded-md border border-border bg-background px-2 py-1 text-xs capitalize"
                    >
                      {TICKET_STATE_OPTIONS.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    No tickets in this view.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          {!active ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Select a ticket to read the thread and reply.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {active.subject}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_TONE[active.status] ?? ""}`}>
                    {STATUS_LABEL[active.status] ?? active.status}
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {active.reference ? `${active.reference} · ` : ""}
                  {active.full_name ?? active.legalName ?? active.displayName}
                  {active.email ? ` · ${active.email}` : ""} ·{" "}
                  {new Date(active.created_at).toLocaleString()}
                </p>
                <p className="text-[11px] text-muted-foreground capitalize">
                  {active.category} · {active.priority} priority
                </p>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {messages
                  .filter((m) => m.ticket_id === active.id)
                  .map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-lg px-3 py-2 text-xs ${
                        m.sender_role === "user" ? "bg-secondary" : "bg-primary/10 text-primary"
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{m.body}</p>
                      {m.attachment_path && (
                        <ChatAttachment
                          path={m.attachment_path}
                          name={m.attachment_name}
                          type={m.attachment_type}
                        />
                      )}
                    </div>
                  ))}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder="Official agent reply…"
                className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() =>
                  draft.trim() && replyMutation.mutate({ ticketId: active.id, body: draft.trim() })
                }
                disabled={replyMutation.isPending}
                className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                {replyMutation.isPending ? "Sending…" : "Send reply"}
              </button>
              {active.status === "resolved" ? (
                <button
                  onClick={() =>
                    statusMutation.mutate({ ticketId: active.id, status: "open" })
                  }
                  disabled={statusMutation.isPending}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Reopen ticket
                </button>
              ) : (
                <button
                  onClick={() =>
                    statusMutation.mutate({ ticketId: active.id, status: "resolved" })
                  }
                  disabled={statusMutation.isPending}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-bull px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
                >
                  <CheckCircle2 className="size-4" />
                  Close ticket / Mark resolved
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
