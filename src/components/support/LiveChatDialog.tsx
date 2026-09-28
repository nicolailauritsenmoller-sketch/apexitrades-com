import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  Check,
  CheckCheck,
  Clock,
  Lock,
  Paperclip,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Timer,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  BOT_TOPICS,
  findQA,
  findTopic,
  matchQuestion,
  wantsAgent,
  type BotTopicId,
} from "@/lib/support-bot";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { ChatComposerInput } from "@/components/support/ChatComposerInput";
import { UserAvatar } from "@/components/UserAvatar";
import { getMyChatContext, requestLiveAgent, submitChatRating } from "@/lib/desk.functions";
import { shieldMark } from "@/components/Logo";

type Message = {
  id: string;
  session_id: string;
  sender_role: string;
  body: string;
  created_at: string;
  read_at: string | null;
  attachment_path: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  pending?: boolean;
};

type Agent = {
  name: string;
  role: string;
  staffId: string;
  avatarUrl: string | null;
} | null;

const RATED_KEY = "velocity:chat-rated";

type BotChip = { label: string; action: string; tone?: "primary" | "muted" };
type BotMsg = {
  id: string;
  role: "bot" | "user";
  text: string;
  chips?: BotChip[];
  topics?: boolean;
};

const feedbackChips: BotChip[] = [
  { label: "Yes, Thank You", action: "yes", tone: "muted" },
  { label: "No, Speak to Live Agent", action: "agent", tone: "primary" },
];

/** Icon + subtitle for each structured help-topic card in the bot greeting. */
const TOPIC_META: Record<BotTopicId, { icon: LucideIcon; subtitle: string }> = {
  funds: { icon: Wallet, subtitle: "Track pending deposits & funding" },
  scalp: { icon: Timer, subtitle: "Timer countdowns & settling state" },
  margin: { icon: SlidersHorizontal, subtitle: "Tier limits & position constraints" },
  health: { icon: ShieldCheck, subtitle: "Margin risk & trust score rules" },
  verify: { icon: BadgeCheck, subtitle: "Identity & institutional status" },
  security: { icon: Lock, subtitle: "Authenticator & security settings" },
};

/** Platform logo used as the default face of every support agent. */
function AgentAvatar({ src, className = "size-8" }: { src?: string | null; className?: string }) {
  return (
    <img
      src={src || shieldMark}
      alt="Velocity Trade support"
      className={`${className} shrink-0 rounded-full border border-border bg-background object-cover p-0.5`}
    />
  );
}

/** Structured 2-column grid of topic cards shown by the support bot. */
function TopicGrid({ onPick }: { onPick: (topicId: BotTopicId) => void }) {
  return (
    <div className="mt-2.5 w-full">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Popular help topics
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BOT_TOPICS.map((t) => {
          const Icon = TOPIC_META[t.id].icon;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className="group flex min-h-20 touch-manipulation items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4 text-foreground">{t.label}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {TOPIC_META[t.id].subtitle}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Standard support live chat rendered as a dialog (no floating launcher).
 * Can be controlled via `open`/`onOpenChange`, and also listens for the
 * global `velocity:open-chat` event so other surfaces (e.g. trade close
 * summary) can open it with a pre-filled message.
 */
export function LiveChatDialog({
  open: controlledOpen,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      setInternalOpen(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
  );

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [agent, setAgent] = useState<Agent>(null);
  const [rating, setRating] = useState(false);
  const [mode, setMode] = useState<"bot" | "agent">("bot");
  const [botLog, setBotLog] = useState<BotMsg[]>([]);
  const [queuedAt, setQueuedAt] = useState<string | null>(null);
  const [connectedAt, setConnectedAt] = useState<string | null>(null);
  const [identity, setIdentity] = useState<{ name: string; uid: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const escalatingRef = useRef(false);

  /* Global open event — supports an optional pre-filled message.
     Only the uncontrolled (global) instance listens, so a controlled
     instance mounted on the support page never double-opens. */
  useEffect(() => {
    if (controlledOpen !== undefined) return;
    const handler = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) setDraft(detail.message);
    };
    window.addEventListener("velocity:open-chat", handler);
    return () => window.removeEventListener("velocity:open-chat", handler);
  }, [setOpen, controlledOpen]);

  /* Resolve or create the user's chat session. */
  useEffect(() => {
    if (!open || sessionId) return;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.user.id)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setSessionId(existing.id);
        if (existing.escalated_at && existing.status !== "closed") {
          setMode("agent");
          setQueuedAt(existing.escalated_at);
          setConnectedAt(existing.connected_at);
          escalatingRef.current = true;
        }
        return;
      }
      const { data: created } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.user.id, subject: "Support" })
        .select()
        .single();
      if (created) setSessionId(created.id);
    })();
  }, [open, sessionId]);

  /* Account identity for the dynamic greeting. */
  useEffect(() => {
    if (!open || identity) return;
    (async () => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.user.id)
        .maybeSingle();
      const p = data as { display_name?: string | null; uid?: string | null } | null;
      setIdentity({
        name: p?.display_name?.split(" ")[0] || user.user.email?.split("@")[0] || "there",
        uid: p?.uid ?? user.user.id.slice(0, 7).toUpperCase(),
      });
    })();
  }, [open, identity]);

  useEffect(() => {
    if (!open || mode !== "bot" || !identity || botLog.length) return;
    setBotLog([
      {
        id: "greet",
        role: "bot",
        text: `Hello ${identity.name} [ID: ${identity.uid}], how can Velocity Support assist you today?`,
        topics: true,
      },
    ]);
  }, [open, mode, identity, botLog.length]);

  /* Message thread with a resilient realtime subscription. */
  useEffect(() => {
    if (!sessionId) return;
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sessionId!)
        .order("created_at");
      if (active) setMessages((data ?? []) as Message[]);
    }
    load();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    function merge(row: Message) {
      setMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (m) => !(m.pending && m.body === row.body && m.sender_role === row.sender_role),
        );
        if (withoutOptimistic.some((m) => m.id === row.id)) {
          return withoutOptimistic.map((m) => (m.id === row.id ? { ...m, ...row } : m));
        }
        return [...withoutOptimistic, row];
      });
    }

    function subscribe() {
      channel = supabase
        .channel(`chat-${sessionId}`, { config: { broadcast: { ack: false } } })
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "chat_messages",
            filter: `session_id=eq.${sessionId}`,
          },
          (payload) => {
            const row = payload.new as Message;
            if (row?.id) merge(row);
          },
        )
        .subscribe((status) => {
          if (!active) return;
          if (status === "SUBSCRIBED") void load();
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (channel) supabase.removeChannel(channel);
            channel = null;
            retry = setTimeout(subscribe, 1200);
          }
        });
    }
    subscribe();

    const resync = () => void load();
    window.addEventListener("online", resync);
    window.addEventListener("focus", resync);

    return () => {
      active = false;
      if (retry) clearTimeout(retry);
      window.removeEventListener("online", resync);
      window.removeEventListener("focus", resync);
      if (channel) supabase.removeChannel(channel);
    };
  }, [sessionId]);

  /* Agent persona, durable queue state, and read-receipt sync. */
  useEffect(() => {
    if (!sessionId || !open) return;
    let active = true;
    const sync = async () => {
      try {
        const res = await getMyChatContext({ data: { sessionId } });
        if (!active) return;
        setAgent(res.agent as Agent);
        if (res.status === "missing") {
          setSessionId(null);
          setMessages([]);
          setMode("bot");
          setQueuedAt(null);
          setConnectedAt(null);
          escalatingRef.current = false;
          return;
        }
        if (res.queuedAt && res.status !== "closed") {
          setMode("agent");
          setQueuedAt(res.queuedAt);
          setConnectedAt(res.connectedAt);
          escalatingRef.current = true;
        }
      } catch {
        /* not signed in yet */
      }
    };
    sync();
    const timer = setInterval(sync, 20_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [sessionId, open, messages.length]);

  /* Session changes carry the queue-to-connected transition in realtime. */
  useEffect(() => {
    if (!sessionId || !open) return;
    const channel = supabase
      .channel(`chat-session-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_sessions",
          filter: `id=eq.${sessionId}`,
        },
        () => {
          void getMyChatContext({ data: { sessionId } })
            .then((res) => {
              setAgent(res.agent as Agent);
              if (res.status === "missing") {
                setSessionId(null);
                setMessages([]);
                setMode("bot");
                setQueuedAt(null);
                setConnectedAt(null);
                escalatingRef.current = false;
                return;
              }
              if (res.queuedAt && res.status !== "closed") {
                setMode("agent");
                setQueuedAt(res.queuedAt);
                setConnectedAt(res.connectedAt);
                escalatingRef.current = true;
              }
            })
            .catch(() => {
              /* A stale realtime event must never escape into the page. */
            });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, botLog]);

  const botSay = (text: string, opts?: { chips?: BotChip[]; topics?: boolean }) =>
    setBotLog((l) => [...l, { id: crypto.randomUUID(), role: "bot", text, ...opts }]);
  const userSay = (text: string) =>
    setBotLog((l) => [...l, { id: crypto.randomUUID(), role: "user", text }]);

  async function escalate(lastQuestion?: string) {
    if (mode === "agent" || escalatingRef.current || !sessionId) return;
    escalatingRef.current = true;
    setMode("agent");
    setConnectedAt(null);
    try {
      const transcript = botLog
        .map(({ role, text }) => ({ role, text }))
        .concat(lastQuestion ? [{ role: "user" as const, text: lastQuestion }] : [])
        .slice(-24);
      const res = await requestLiveAgent({
        data: {
          sessionId,
          context: { requestedWith: lastQuestion ?? null, messages: transcript },
        },
      });
      setQueuedAt(res.queuedAt);
      setConnectedAt(res.connectedAt);
    } catch {
      escalatingRef.current = false;
      setMode("bot");
    }
  }

  function handleTopic(topicId: BotTopicId) {
    const t = findTopic(topicId);
    if (!t) return;
    userSay(t.label);
    botSay(`Here are common ${t.label} questions:`, {
      chips: t.items.map((i) => ({ label: i.q, action: `qa:${i.id}` })),
    });
  }

  function handleChip(chip: BotChip) {
    const [kind, id] = chip.action.split(":");
    userSay(chip.label);
    if (kind === "qa") {
      const qa = findQA(id);
      if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips });
    } else if (kind === "yes") {
      botSay("Glad we could help! Anything else?", { topics: true });
    } else if (kind === "agent") {
      void escalate();
    }
  }

  function botReply(text: string) {
    userSay(text);
    if (wantsAgent(text)) return void escalate(text);
    const qa = matchQuestion(text);
    if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips });
    else
      botSay("I couldn't find an exact answer for that — pick a topic below.", { topics: true });
  }

  const agentJoined = Boolean(connectedAt);
  const visibleMessages = messages.filter(
    (message) =>
      !message.body.startsWith("[Live agent requested]") &&
      !message.body.includes("Bot transcript:"),
  );

  async function send() {
    if (mode === "bot") {
      const text = draft.trim();
      if (!text) return;
      setDraft("");
      botReply(text);
      return;
    }
    const body = draft.trim();
    if ((!body && !file) || !sessionId || sending) return;
    setSending(true);
    setDraft("");
    const tempId = `pending-${crypto.randomUUID()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        session_id: sessionId,
        sender_role: "user",
        body: body || file?.name || "Attachment",
        created_at: new Date().toISOString(),
        read_at: null,
        attachment_path: null,
        attachment_name: null,
        attachment_type: null,
        pending: true,
      },
    ]);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      setSending(false);
      return;
    }

    let attachment: Record<string, string | null> = {};
    if (file) {
      const path = `${user.user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (!error) {
        attachment = {
          attachment_path: path,
          attachment_name: file.name,
          attachment_type: file.type,
        };
      }
      setFile(null);
    }

    const { data: inserted, error: insertError } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        sender_id: user.user.id,
        sender_role: "user",
        body: body || (attachment["attachment_name"] ?? "Attachment"),
        ...attachment,
      })
      .select()
      .single();

    if (insertError) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(body);
      setSending(false);
      return;
    }
    if (inserted) {
      setMessages((prev) => {
        const rest = prev.filter((m) => m.id !== tempId && m.id !== inserted.id);
        return [...rest, inserted as Message];
      });
    }
    await supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", sessionId);
    setSending(false);
  }

  function close() {
    setOpen(false);
    if (sessionId && messages.length > 0 && localStorage.getItem(RATED_KEY) !== sessionId) {
      setRating(true);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) setOpen(true);
          else close();
        }}
      >
        <DialogContent className="flex h-[78vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
          <DialogTitle className="sr-only">Live chat with customer support</DialogTitle>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AgentAvatar src={agent?.avatarUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {mode === "bot" ? "Velocity Support Assistant" : (agent?.name ?? "Customer support")}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {mode === "bot"
                  ? "Automated · 24/7 Live Assistance"
                    : agentJoined
                      ? "Connected with Agent"
                      : "Queued for Support Agent · ~2 mins"}
              </p>
            </div>
          </div>

          {/* Thread */}
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {queuedAt && !agentJoined && (
              <div className="flex items-start gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-3 text-xs leading-5 text-foreground">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>
                  <strong>Hello {identity?.name ?? "User"} [{identity?.uid ?? "—"}]</strong> • You have
                  been placed in the Live Support queue. Estimated wait time: ~2 mins. An agent will
                  join this chat shortly.
                </span>
              </div>
            )}
            {agentJoined && (
              <div className="flex items-start gap-2 rounded-md border border-bull/40 bg-bull/10 px-3 py-3 text-xs leading-5 text-foreground">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-bull" />
                <span>
                  <strong>{agent?.name ?? "A support agent"}</strong> ({agent?.role ?? "Support Agent"})
                  has joined the chat.
                </span>
              </div>
            )}
            {mode === "bot" && botLog.map((b) => (
              <div key={b.id} className={`flex items-end gap-2 ${b.role === "user" ? "justify-end" : ""}`}>
                {b.role === "bot" && (
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-background text-primary">
                    <Bot className="size-4" />
                  </span>
                )}
                <div className="max-w-[85%]">
                  <div
                    className={`whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                      b.role === "user" ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}
                  >
                    {b.text}
                  </div>
                  {b.topics && mode === "bot" && <TopicGrid onPick={handleTopic} />}
                  {b.chips && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.chips.map((c) => (
                        <button
                          key={c.action + c.label}
                          onClick={() => handleChip(c)}
                          className={`touch-manipulation rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                            c.tone === "primary"
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-card hover:border-primary/60 hover:text-primary"
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {mode === "agent" && visibleMessages.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Send us a message and an agent will join shortly.
              </p>
            )}
            {mode === "agent" && visibleMessages.map((m) => (
              <div
                key={m.id}
                className={`flex items-end gap-2 ${m.sender_role === "user" ? "justify-end" : ""}`}
              >
                {m.sender_role !== "user" && (
                  <AgentAvatar src={agent?.avatarUrl} className="size-7" />
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.sender_role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground"
                  } ${m.pending ? "opacity-70" : ""}`}
                >
                  {m.sender_role !== "user" && agent && (
                    <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">
                      {agent.name} — {agent.role}
                    </p>
                  )}
                  {m.body}
                  {m.attachment_path && (
                    <ChatAttachment
                      messageId={m.id}
                      name={m.attachment_name}
                      type={m.attachment_type}
                    />
                  )}
                  <span className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {m.sender_role === "user" &&
                      (m.read_at ? <CheckCheck className="size-3" /> : <Check className="size-3" />)}
                  </span>
                </div>
                {m.sender_role === "user" && <UserAvatar className="size-7" alt="You" />}
              </div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Escalation action bar */}
          {mode === "bot" && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              <span>Need urgent manual help?</span>
              <button
                onClick={() => void escalate()}
                className="touch-manipulation font-semibold text-primary hover:underline"
              >
                Connect to Live Agent
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="flex flex-wrap items-end gap-2 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
              hidden={mode === "bot"}
              onClick={() => fileRef.current?.click()}
              aria-label="Attach a photo or document"
              className="grid size-9 shrink-0 touch-manipulation place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Paperclip className="size-4" />
            </button>
            <ChatComposerInput
              value={draft}
              onChange={setDraft}
              onSubmit={send}
              placeholder={mode === "bot" ? "Ask a question or type 'agent'…" : "Type a message…"}
              maxLength={4000}
              className="rounded-md bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground"
            />
            <button
              onClick={send}
              aria-label="Send message"
              className="grid size-9 shrink-0 touch-manipulation place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              disabled={sending}
            >
              <Send className="size-4" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {rating && sessionId && (
        <RatingModal
          sessionId={sessionId}
          onClose={() => {
            localStorage.setItem(RATED_KEY, sessionId);
            setRating(false);
          }}
        />
      )}
    </>
  );
}

/** Post-session 5-star rating and feedback prompt. */
function RatingModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [stars, setStars] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!stars || busy) return;
    setBusy(true);
    try {
      await submitChatRating({
        data: { sessionId, stars, feedback: feedback.trim() || undefined },
      });
    } catch {
      /* ignore — never block the user on feedback */
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="font-display text-base font-bold tracking-tight">How did we do?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Rate your support experience — it helps us improve.
        </p>
        <div className="mt-4 flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setStars(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="touch-manipulation p-1"
            >
              <Star
                className={`size-7 ${n <= stars ? "fill-warning text-warning" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Anything else you'd like to tell us? (optional)"
          className="mt-4 w-full resize-none rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 touch-manipulation rounded-md border border-border py-2 text-sm"
          >
            Not now
          </button>
          <button
            onClick={submit}
            disabled={!stars || busy}
            className="flex-1 touch-manipulation rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
