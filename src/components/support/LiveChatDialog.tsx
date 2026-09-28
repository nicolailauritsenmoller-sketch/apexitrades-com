import { markAllSupportRead } from "@/lib/use-support-unread";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  Check,
  CheckCheck,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { useChatTyping } from "@/lib/use-chat-typing";
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

type PastSession = {
  id: string;
  status: string;
  endedAt: string;
  bot: { role: "bot" | "user"; text: string }[];
  msgs: Message[];
};

function readBotLog(ctx: unknown): { id: string; role: "bot" | "user"; text: string }[] {
  const list = (ctx as { messages?: { role?: string; text?: string }[] } | null)?.messages;
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => typeof m?.text === "string")
    .map((m, i) => ({ id: `saved-${i}`, role: m.role === "user" ? "user" : "bot", text: m.text! }));
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

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
  const typing = useChatTyping(sessionId, "user");
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
  const pendingEscalationRef = useRef(false);
  const [ended, setEnded] = useState(false);
  const [csatDone, setCsatDone] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endedByAgent, setEndedByAgent] = useState(false);
  const [history, setHistory] = useState<PastSession[]>([]);
  const endedByMeRef = useRef(false);

  /** Apply the durable session state reported by the backend. */
  function applyContext(res: {
    status: string;
    queuedAt: string | null;
    connectedAt: string | null;
  }) {
    if (res.status === "missing") {
      setSessionId(null);
      setMessages([]);
      setMode("bot");
      setQueuedAt(null);
      setConnectedAt(null);
      setEnded(false);
      escalatingRef.current = false;
      pendingEscalationRef.current = false;
      return;
    }
    if (res.status === "closed") {
      // Only a live-agent session that was active in this widget transitions
      // to the ended state; old closed sessions simply stay on the bot home.
      if (escalatingRef.current) {
        setConnectedAt(res.connectedAt);
        if (!endedByMeRef.current) setEndedByAgent(true);
        setEnded(true);
        setEndConfirm(false);
      }
      return;
    }
    if (res.queuedAt) {
      setMode("agent");
      setQueuedAt(res.queuedAt);
      setConnectedAt(res.connectedAt);
      escalatingRef.current = true;
    }
  }

  async function endChat() {
    if (!sessionId || ending) return;
    setEnding(true);
    endedByMeRef.current = true;
    const { error } = await supabase
      .from("chat_sessions")
      .update({ status: "closed" })
      .eq("id", sessionId);
    setEnding(false);
    setEndConfirm(false);
    if (!error) setEnded(true);
    else endedByMeRef.current = false;
  }

  /** Reset to the automated bot home on a fresh session. */
  async function startNewInquiry() {
    if (sessionId) localStorage.setItem(RATED_KEY, sessionId);
    escalatingRef.current = false;
    pendingEscalationRef.current = false;
    endedByMeRef.current = false;
    setEndedByAgent(false);
    setEnded(false);
    setCsatDone(false);
    setEndConfirm(false);
    setMode("bot");
    setQueuedAt(null);
    setConnectedAt(null);
    setAgent(null);
    setMessages([]);
    setBotLog([]);
    setDraft("");
    setFile(null);
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { data: created } = await supabase
      .from("chat_sessions")
      .insert({ user_id: user.user.id, subject: "Support" })
      .select()
      .single();
    if (created) {
      setSessionId(created.id);
      await loadHistory(user.user.id, created.id);
    }
  }

  /* Global open event - supports an optional pre-filled message.
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

  /* Load every earlier session for this user as a read-only transcript. */
  const loadHistory = useCallback(async (userId: string, excludeId: string) => {
    const { data: sessions } = await supabase
      .from("chat_sessions")
      .select("id, created_at, status, last_message_at, bot_context")
      .eq("user_id", userId)
      .neq("id", excludeId)
      .order("created_at", { ascending: true });
    const ids = (sessions ?? []).map((s) => s.id);
    const { data: msgs } = ids.length
      ? await supabase.from("chat_messages").select("*").in("session_id", ids).order("created_at")
      : { data: [] as Message[] };
    const past: PastSession[] = (sessions ?? [])
      .map((s) => ({
        id: s.id,
        status: s.status,
        endedAt: s.last_message_at,
        bot: readBotLog(s.bot_context),
        msgs: ((msgs ?? []) as Message[]).filter(
          (m) =>
            m.session_id === s.id &&
            !m.body.startsWith("[Live agent requested]") &&
            !m.body.includes("Bot transcript:"),
        ),
      }))
      .filter((s) => s.bot.some((b) => b.role === "user") || s.msgs.length > 0);
    setHistory(past);
  }, []);

  /* Opening the widget clears the unread badge and keeps past-session
     follow-ups from agents (async replies) live while it stays open. */
  useEffect(() => {
    if (!open || !sessionId) return;
    void markAllSupportRead();
    const channel = supabase
      .channel(`support-history-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        async (payload) => {
          const row = payload.new as { session_id?: string };
          if (row.session_id === sessionId) {
            void markAllSupportRead();
            return;
          }
          const { data: u } = await supabase.auth.getUser();
          if (u.user) {
            await loadHistory(u.user.id, sessionId);
            void markAllSupportRead();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, sessionId, loadHistory]);

  /* Resolve or create the user's chat session. Closed sessions become history. */
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

      if (existing && existing.status !== "closed") {
        setSessionId(existing.id);
        const saved = readBotLog(existing.bot_context);
        if (saved.length) setBotLog(saved);
        if (existing.escalated_at) {
          setMode("agent");
          setQueuedAt(existing.escalated_at);
          setConnectedAt(existing.connected_at);
          escalatingRef.current = true;
        }
        void loadHistory(user.user.id, existing.id);
        return;
      }
      const { data: created } = await supabase
        .from("chat_sessions")
        .insert({ user_id: user.user.id, subject: "Support" })
        .select()
        .single();
      if (created) {
        setSessionId(created.id);
        void loadHistory(user.user.id, created.id);
      }
    })();
  }, [open, sessionId, loadHistory]);

  /* Persist the automated conversation privately on the session. */
  useEffect(() => {
    if (!sessionId || mode !== "bot" || !botLog.some((b) => b.role === "user")) return;
    const t = setTimeout(() => {
      void supabase
        .from("chat_sessions")
        .update({
          bot_context: { messages: botLog.map(({ role, text }) => ({ role, text })).slice(-60) },
        })
        .eq("id", sessionId);
    }, 600);
    return () => clearTimeout(t);
  }, [botLog, sessionId, mode]);

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
        text: `Hello User ${identity.uid}, how can Velocity Support assist you today?`,
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
        applyContext(res);
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
              applyContext(res);
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

  /* Optimistically switch to the queue view on the very first click - the
     backend request must never gate the UI change. If the session row does
     not exist yet, the request is deferred until it does. */
  async function escalate(lastQuestion?: string) {
    if (mode === "agent" || escalatingRef.current) return;
    escalatingRef.current = true;
    setMode("agent");
    setConnectedAt(null);
    if (!sessionId) {
      pendingEscalationRef.current = true;
      return;
    }
    await runEscalation(lastQuestion);
  }

  async function runEscalation(lastQuestion?: string, attempt = 0) {
    if (!sessionId) return;
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
      pendingEscalationRef.current = false;
    } catch {
      if (attempt < 2) {
        setTimeout(() => void runEscalation(lastQuestion, attempt + 1), 800 * (attempt + 1));
      } else {
        escalatingRef.current = false;
        pendingEscalationRef.current = false;
        setMode("bot");
      }
    }
  }

  /* Escalation clicked before the session existed - run it once it exists. */
  useEffect(() => {
    if (!sessionId || !pendingEscalationRef.current) return;
    pendingEscalationRef.current = false;
    void runEscalation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
    if (kind === "agent") {
      // Escalate immediately without echoing the chip label into the thread.
      void escalate();
      return;
    }
    userSay(chip.label);
    if (kind === "qa") {
      const qa = findQA(id);
      if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips });
    } else if (kind === "yes") {
      botSay("Glad we could help! Anything else?", { topics: true });
    }
  }

  function botReply(text: string) {
    userSay(text);
    if (wantsAgent(text)) return void escalate(text);
    const qa = matchQuestion(text);
    if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips });
    else
      botSay("I couldn't find an exact answer for that - pick a topic below.", { topics: true });
  }

  const agentJoined = Boolean(connectedAt);
  const visibleMessages = messages.filter(
    (message) =>
      !message.body.startsWith("[Live agent requested]") &&
      !message.body.includes("Bot transcript:"),
  );
  const threadItems: Message[] = (() => {
    if (!connectedAt) return visibleMessages;
    const t = new Date(connectedAt).getTime();
    const before = visibleMessages.filter((m) => new Date(m.created_at).getTime() < t);
    const after = visibleMessages.filter((m) => new Date(m.created_at).getTime() >= t);
    return [...before, { id: "__joined" } as Message, ...after];
  })();

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
    typing.notifyStop();
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
    if (!ended && connectedAt && sessionId && messages.length > 0 && localStorage.getItem(RATED_KEY) !== sessionId) {
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
                  : ended
                    ? "Session Closed"
                    : agentJoined
                      ? "Connected with Agent"
                      : "Queued for Support Agent · ~2 mins"}
              </p>
            </div>
            {mode === "agent" && agentJoined && !ended && (
              <Popover open={endConfirm} onOpenChange={setEndConfirm}>
                <PopoverTrigger asChild>
                  <button className="ml-auto mr-8 touch-manipulation rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-bear/50 hover:text-bear">
                    End Chat
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <p className="text-xs leading-5 text-foreground">
                    Are you sure you want to end this support session?
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setEndConfirm(false)}
                      className="touch-manipulation rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => void endChat()}
                      disabled={ending}
                      className="touch-manipulation rounded-md bg-bear px-3 py-1.5 text-xs font-semibold text-bear-foreground disabled:opacity-50"
                    >
                      {ending ? "Ending…" : "End Session"}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Thread */}
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {history.map((s) => (
              <div key={s.id} className="space-y-2 opacity-80">
                {s.bot.map((b, i) => (
                  <div key={`${s.id}-b${i}`} className={`flex ${b.role === "user" ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                        b.role === "user" ? "bg-primary/80 text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {b.text}
                    </div>
                  </div>
                ))}
                {s.msgs.map((m) => (
                  <div key={m.id} className={`flex ${m.sender_role === "user" ? "justify-end" : ""}`}>
                    <div
                      className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                        m.sender_role === "user" ? "bg-primary/80 text-primary-foreground" : "bg-secondary text-foreground"
                      }`}
                    >
                      {m.sender_role !== "user" && (
                        <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">Support Agent</p>
                      )}
                      {m.body}
                    </div>
                  </div>
                ))}
                <Divider
                  label={`Session Ended (${new Date(s.endedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })})`}
                />
              </div>
            ))}
            {history.length > 0 && <Divider label="New Inquiry Started" />}
            {botLog.map((b) => (
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
                  {b.chips && mode === "bot" && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.chips.map((c) => (
                        <button
                          type="button"
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
            {mode === "agent" && !agentJoined && !ended && (
              <p className="pt-4 text-center text-sm text-muted-foreground">
                Send us a message and an agent will join shortly.
              </p>
            )}
            {mode === "agent" && threadItems.map((m) => m.id === "__joined" ? (
              <div key="__joined" className="flex items-start gap-2 rounded-md border border-bull/40 bg-bull/10 px-3 py-3 text-xs leading-5 text-foreground">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-bull" />
                <span>
                  <strong>{agent?.name ?? "A support agent"}</strong> ({agent?.role ?? "Support Agent"})
                  has joined the chat.
                </span>
              </div>
            ) : (
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
                      {agent.name} - {agent.role}
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
                      (m.pending ? (
                        <span className="inline-flex items-center gap-0.5"><Check className="size-3" /> Sent</span>
                      ) : m.read_at ? (
                        <span className="inline-flex items-center gap-0.5"><CheckCheck className="size-3" /> Read</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5"><CheckCheck className="size-3" /> Delivered</span>
                      ))}
                  </span>
                </div>
                {m.sender_role === "user" && <UserAvatar className="size-7" alt="You" />}
              </div>
            ))}
            {mode === "agent" && !ended && agentJoined && typing.peerTyping && (
              <p className="px-1 text-xs italic text-muted-foreground">{agent?.name ?? "Agent"} is typing…</p>
            )}
            {mode === "agent" && ended && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-3 text-xs leading-5 text-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {endedByAgent ? (
                  <span>
                    <strong>Agent has ended chat</strong> • Support session closed.
                  </span>
                ) : (
                  <span>
                    <strong>Chat Session Ended</strong> • This support ticket has been closed.
                  </span>
                )}
              </div>
            )}
            {mode === "agent" && ended && (agentJoined || endedByAgent) && !csatDone && sessionId && (
              <CsatCard
                sessionId={sessionId}
                agentName={agent?.name ?? "our support team"}
                onDone={() => {
                  setCsatDone(true);
                  void startNewInquiry();
                }}
              />
            )}
            <div ref={endRef} />
          </div>

          {/* Escalation action bar */}
          {mode === "bot" && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-border bg-secondary/40 px-3 py-2.5 text-xs text-muted-foreground">
              <span>Need urgent manual help?</span>
              <button
                type="button"
                onClick={() => void escalate()}
                className="touch-manipulation font-semibold text-primary hover:underline"
              >
                Connect to Live Agent
              </button>
            </div>
          )}

          {/* Composer */}
          {ended ? (
            <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                onClick={() => void startNewInquiry()}
                className="w-full touch-manipulation rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Start New Inquiry
              </button>
            </div>
          ) : (
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
              onChange={(v) => {
                setDraft(v);
                if (mode === "agent" && !ended) typing.notifyTyping();
              }}
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
          )}
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
      /* ignore - never block the user on feedback */
    }
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-2xl">
        <h3 className="font-display text-base font-bold tracking-tight">How did we do?</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Rate your support experience - it helps us improve.
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

/** Inline CSAT card shown in the thread right after an agent session ends. */
function CsatCard({
  sessionId,
  agentName,
  onDone,
}: {
  sessionId: string;
  agentName: string;
  onDone: () => void;
}) {
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
      /* never block the user on feedback */
    }
    setBusy(false);
    onDone();
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">
        How was your support experience with {agentName}?
      </p>
      <div className="mt-3 flex justify-center gap-1">
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
        rows={2}
        maxLength={1000}
        placeholder="Additional feedback (optional)"
        className="mt-3 w-full resize-none rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={onDone}
          className="flex-1 touch-manipulation rounded-md border border-border py-2 text-xs"
        >
          Skip
        </button>
        <button
          onClick={submit}
          disabled={!stars || busy}
          className="flex-1 touch-manipulation rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Submitting…" : "Submit Feedback"}
        </button>
      </div>
    </div>
  );
}
