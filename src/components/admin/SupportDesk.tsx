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
  Lock,
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
  getTicketAttachmentUrl,
  listSupportAgents,
  updateTicketFields,
  addTicketInternalNote,
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
  urgent: "text-ops-red",
};

const STATUS_TONE: Record<string, string> = {
  open: "bg-primary/10 text-primary",
  in_progress: "bg-primary/10 text-primary",
  pending: "bg-warning/10 text-warning",
  waiting_customer: "bg-warning/10 text-warning",
  resolved: "bg-ops-emerald-bg text-ops-emerald",
  closed: "bg-secondary text-muted-foreground",
};

export function SupportDesk({
  initialView = "inbox",
}: {
  initialView?: "inbox" | "requests" | "tickets";
}) {
  const [view, setView] = useState<"inbox" | "requests" | "tickets">(initialView);
  useEffect(() => setView(initialView), [initialView]);
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-card p-1">
        {(
          [
            { id: "inbox", label: "Live chat inboxes", icon: Inbox },
            { id: "requests", label: "Submitted requests", icon: Inbox },
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
      {view === "inbox" ? <ChatInboxes /> : <TicketsDesk mode={view} />}
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

const CATEGORY_OPTIONS = [
  "account",
  "kyc",
  "deposits",
  "withdrawals",
  "trading",
  "wallet",
  "security",
  "technical",
  "fees",
  "settings",
  "general",
  "other",
] as const;

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"] as const;

const SORTS = [
  { id: "recent", label: "Newest" },
  { id: "priority", label: "Priority" },
  { id: "status", label: "Status" },
  { id: "customer", label: "Customer" },
] as const;
type SortKey = (typeof SORTS)[number]["id"];

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** Acknowledgment → Understanding → Action → Next step. */
function defaultReplyTemplate(ticket: any) {
  const name = (ticket?.full_name ?? ticket?.legalName ?? ticket?.displayName ?? "there")
    .toString()
    .split(" ")[0];
  const issue = String(ticket?.category ?? "your request").replace(/_/g, " ");
  const ref = ticket?.reference ?? String(ticket?.id ?? "").slice(0, 8).toUpperCase();
  return `Hello ${name},

Thank you for contacting Support. We've received your request regarding ${issue} and ticket #${ref} has been assigned.

We are currently reviewing your account details and will update you directly through this thread as soon as we have completed our investigation.

Next step: No further action is needed from your end right now. If we require additional details, we will notify you here.

Regards,
Support Team`;
}

function TicketsDesk({ mode = "tickets" }: { mode?: "requests" | "tickets" }) {
  const isRequests = mode === "requests";
  const qc = useQueryClient();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [note, setNote] = useState("");
  const [notes, setNotes] = useState("");

  const fetchTickets = useServerFn(getSupportTickets);
  const fetchAgents = useServerFn(listSupportAgents);
  const setStatus = useServerFn(updateTicketStatus);
  const reply = useServerFn(replyToTicket);
  const markRead = useServerFn(markTicketRead);
  const updateFields = useServerFn(updateTicketFields);
  const addNote = useServerFn(addTicketInternalNote);

  const query = useQuery({
    queryKey: ["support-tickets"],
    queryFn: () => fetchTickets(),
    refetchInterval: 20_000,
  });

  const agentsQuery = useQuery({
    queryKey: ["support-agents"],
    queryFn: () => fetchAgents(),
    staleTime: 5 * 60_000,
  });
  const agents = (agentsQuery.data ?? []) as { id: string; name: string; role: string }[];

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
    mutationFn: (v: { ticketId: string; status: string; resolutionNote?: string }) =>
      setStatus({ data: v }),
    onSuccess: async () => {
      toast.success("Ticket updated");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["desk-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldsMutation = useMutation({
    mutationFn: (v: Record<string, unknown>) => updateFields({ data: v as any }),
    onSuccess: async () => {
      toast.success("Ticket saved");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const noteMutation = useMutation({
    mutationFn: (v: { ticketId: string; body: string }) => addNote({ data: v }),
    onSuccess: async () => {
      setNote("");
      toast.success("Internal note added (private)");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: (v: { ticketId: string; body: string; status?: string }) => reply({ data: v as any }),
    onSuccess: async () => {
      setDraft("");
      toast.success("Reply sent to the trader's dashboard");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allTickets = ((query.data as any)?.tickets ?? []) as any[];
  const messages = ((query.data as any)?.messages ?? []) as any[];
  /** A submitted request is a brand-new form: still Open and not yet assigned. */
  const isTriage = (t: any) => t.status === "open" && !t.assigned_agent_id;
  const tickets = useMemo(
    () => allTickets.filter((t) => (isRequests ? isTriage(t) : !isTriage(t))),
    [allTickets, isRequests],
  );
  const filtered = useMemo(() => {
    const rule = STATUS_FILTERS.find((f) => f.id === filter)!;
    const term = search.trim().toLowerCase();
    const rows = tickets.filter(
      (t) =>
        (isRequests || rule.match(t.status)) &&
        (!term ||
          [t.reference, t.subject, t.full_name, t.legalName, t.displayName, t.email]
            .filter(Boolean)
            .some((v: string) => String(v).toLowerCase().includes(term))),
    );
    const sorted = [...rows];
    sorted.sort((a, b) => {
      if (sort === "priority")
        return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
      if (sort === "status") return String(a.status).localeCompare(String(b.status));
      if (sort === "customer")
        return String(a.full_name ?? a.displayName).localeCompare(
          String(b.full_name ?? b.displayName),
        );
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return sorted;
  }, [tickets, filter, sort, search, isRequests]);
  const active = tickets.find((t) => t.id === activeId) ?? null;

  /** One click: claim the request and turn it into an active ticket thread. */
  const convertMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const me = auth.user?.id;
      if (me) await updateFields({ data: { ticketId, assignedAgentId: me } as any });
      await setStatus({ data: { ticketId, status: "in_progress" } });
    },
    onSuccess: async () => {
      toast.success("Converted to an active support ticket");
      await qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Load a professional starter reply and the stored private notes on open.
  useEffect(() => {
    if (!active) return;
    setDraft(defaultReplyTemplate(active));
    setNotes(active.internal_notes ?? "");
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const thread = messages.filter((m) => m.ticket_id === active?.id);

  return (
    <div className="space-y-3">
      {isRequests && (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          {filtered.length} new submission{filtered.length === 1 ? "" : "s"} awaiting triage.
          Convert a request to assign it to yourself and move it into Support Tickets.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!isRequests &&
          STATUS_FILTERS.map((f) => (
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

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ref, subject or customer…"
          className="ml-auto w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs outline-none sm:w-64"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-border bg-background px-2 py-1.5 text-xs"
          aria-label="Sort tickets"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_26rem]">
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2">Ticket ID</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">{isRequests ? "Action" : "Assigned"}</th>
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
                    <span className="flex items-center gap-2">
                      {t.unread > 0 && (
                        <span className="size-2 shrink-0 rounded-full bg-bear" aria-label="Unread" />
                      )}
                      {t.reference ?? "—"}
                    </span>
                    <span className="block max-w-[14rem] truncate text-[10px] text-muted-foreground">
                      {t.subject}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="block truncate text-xs">
                      {t.full_name ?? t.legalName ?? t.displayName}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {t.email ?? t.uid ?? t.user_id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs capitalize">{t.category}</td>
                  <td className={`px-3 py-2 text-xs capitalize ${PRIORITY_TONE[t.priority] ?? ""}`}>
                    {t.priority}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[t.status] ?? ""}`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {isRequests ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          convertMutation.mutate(t.id);
                        }}
                        disabled={convertMutation.isPending}
                        className="rounded-md border border-primary/50 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-60"
                      >
                        Convert to ticket
                      </button>
                    ) : (
                      (t.assignedAgentName ?? "Unassigned")
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-muted-foreground">
                    {isRequests ? "No new submissions awaiting triage." : "No tickets in this view."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          {!active ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              Select a ticket to open the agent workspace.
            </p>
          ) : (
            <div className="space-y-3">
              {/* Customer profile & request info */}
              <div className="rounded-md border border-border bg-secondary/40 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {active.subject}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_TONE[active.status] ?? ""}`}
                  >
                    {STATUS_LABEL[active.status] ?? active.status}
                  </span>
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <div>
                    <dt className="opacity-70">Ticket</dt>
                    <dd className="font-mono text-foreground">{active.reference ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-70">Opened</dt>
                    <dd className="text-foreground">
                      {new Date(active.created_at).toLocaleString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="opacity-70">Customer</dt>
                    <dd className="truncate text-foreground">
                      {active.full_name ?? active.legalName ?? active.displayName}
                    </dd>
                  </div>
                  <div>
                    <dt className="opacity-70">Verified email</dt>
                    <dd className="truncate text-foreground">{active.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-70">UID</dt>
                    <dd className="font-mono text-foreground">{active.uid ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="opacity-70">Last response</dt>
                    <dd className="text-foreground">
                      {active.last_response_at
                        ? new Date(active.last_response_at).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Control actions */}
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Assign
                  <select
                    value={active.assigned_agent_id ?? ""}
                    onChange={(e) =>
                      fieldsMutation.mutate({
                        ticketId: active.id,
                        assignedAgentId: e.target.value || null,
                      })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs capitalize text-foreground"
                  >
                    <option value="">Unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Priority
                  <select
                    value={active.priority}
                    onChange={(e) =>
                      fieldsMutation.mutate({ ticketId: active.id, priority: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs capitalize text-foreground"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Category
                  <select
                    value={active.category}
                    onChange={(e) =>
                      fieldsMutation.mutate({ ticketId: active.id, category: e.target.value })
                    }
                    className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-xs capitalize text-foreground"
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Thread conversation */}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {thread.map((m) => (
                  <div
                    key={m.id}
                    className={`rounded-lg px-3 py-2 text-xs ${
                      m.internal
                        ? "border border-dashed border-warning/50 bg-warning/10 text-warning"
                        : m.sender_role === "user"
                          ? "bg-secondary"
                          : "bg-primary/10 text-primary"
                    }`}
                  >
                    {m.internal && (
                      <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase">
                        <Lock className="size-3" /> Internal note — hidden from customer
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    {m.attachment_path && (
                      <TicketAttachment path={m.attachment_path} name={m.attachment_name} />
                    )}
                    <span className="mt-1 block text-[10px] opacity-70">
                      {new Date(m.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
                {thread.length === 0 && (
                  <p className="text-[11px] text-muted-foreground">No messages yet.</p>
                )}
              </div>

              {/* Reply */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Agent reply
                  </span>
                  <button
                    onClick={() => setDraft(defaultReplyTemplate(active))}
                    className="text-[11px] text-primary hover:underline"
                  >
                    Reset template
                  </button>
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={8}
                  maxLength={4000}
                  placeholder="Official agent reply…"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs outline-none placeholder:text-muted-foreground"
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
              </div>

              {/* Private internal notes */}
              <div className="space-y-2 rounded-md border border-dashed border-border p-2">
                <p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  <Lock className="size-3" /> Private internal notes
                </p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={4000}
                  placeholder="Case notes kept on the ticket record…"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs outline-none"
                />
                <button
                  onClick={() =>
                    fieldsMutation.mutate({ ticketId: active.id, internalNotes: notes })
                  }
                  className="w-full rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                >
                  Save notes
                </button>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Add a timestamped private note to the thread…"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-xs outline-none"
                />
                <button
                  onClick={() =>
                    note.trim() && noteMutation.mutate({ ticketId: active.id, body: note.trim() })
                  }
                  disabled={noteMutation.isPending}
                  className="w-full rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary disabled:opacity-50"
                >
                  Add internal note
                </button>
              </div>

              {/* Lifecycle actions */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() =>
                    statusMutation.mutate({ ticketId: active.id, status: "in_progress" })
                  }
                  className="rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary"
                >
                  Mark In Progress
                </button>
                <button
                  onClick={() =>
                    statusMutation.mutate({ ticketId: active.id, status: "waiting_customer" })
                  }
                  className="rounded-md border border-warning/50 px-3 py-2 text-xs text-warning hover:bg-warning/10"
                >
                  Waiting for Customer
                </button>
                <button
                  onClick={() =>
                    statusMutation.mutate({ ticketId: active.id, status: "resolved" })
                  }
                  disabled={statusMutation.isPending}
                  className="flex items-center justify-center gap-1 rounded-md bg-bull px-3 py-2 text-xs font-medium text-background disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3" /> Resolve
                </button>
                <button
                  onClick={() => statusMutation.mutate({ ticketId: active.id, status: "closed" })}
                  disabled={statusMutation.isPending}
                  className="rounded-md bg-secondary px-3 py-2 text-xs font-medium hover:bg-secondary/70 disabled:opacity-50"
                >
                  Close ticket
                </button>
                {(active.status === "resolved" || active.status === "closed") && (
                  <button
                    onClick={() => statusMutation.mutate({ ticketId: active.id, status: "open" })}
                    className="col-span-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reopen ticket
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


/** Opens a signed link to a ticket attachment for the agent. */
function TicketAttachment({ path, name }: { path: string; name: string | null }) {
  const fetchUrl = useServerFn(getTicketAttachmentUrl);
  const open = async () => {
    const res: any = await fetchUrl({ data: { path } });
    if (res?.url) window.open(res.url, "_blank", "noopener");
    else toast.error("Attachment unavailable.");
  };
  return (
    <button
      onClick={open}
      className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
    >
      <Paperclip className="size-3" />
      {name ?? "Attachment"}
    </button>
  );
}
