import { markAllSupportRead } from "@/lib/use-support-unread";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Bot,
  Globe,
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
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { supportAnswer, supportQuestion, supportLink } from "./support-knowledge-translations";
import { SUPPORT_LANGUAGES, supportText, supportPrompt, supportTopicLabel, type SupportLanguage, type SupportKey } from "./support-translations";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { useChatTyping } from "@/lib/use-chat-typing";
import { ChatComposerInput } from "@/components/support/ChatComposerInput";
import { UserAvatar } from "@/components/UserAvatar";
import { getMyChatContext, getMyRecentActivity, requestLiveAgent, requestManagerChat, submitChatRating } from "@/lib/desk.functions";
import { History } from "lucide-react";
import { shieldMark } from "@/components/Logo";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Crown, Headphones, KeyRound } from "lucide-react";

type QuickPath =
  | "/wallet"
  | "/portfolio"
  | "/profile/verification"
  | "/profile/security"
  | "/profile/help"
  | "/vip-upgrade";
type BotLink = { label: string; to: QuickPath };

type QuickActionId = "kyc" | "funds" | "password" | "vip" | "agent";
const QUICK_ACTIONS: { id: QuickActionId; label: string; icon: LucideIcon }[] = [
  { id: "kyc", label: "KYC Inquiry", icon: BadgeCheck },
  { id: "funds", label: "Deposit / Withdrawal Status", icon: Wallet },
  { id: "password", label: "Reset Password", icon: KeyRound },
  { id: "vip", label: "VIP Account Desk", icon: Crown },
  { id: "agent", label: "Talk to Human Agent", icon: Headphones },
];

const QUICK_ANSWERS: Record<Exclude<QuickActionId, "agent">, { text: string; links: BotLink[] }> = {
  kyc: {
    text:
      "Identity verification has two independent levels:\n\n• Lv.1 - identity attestation: personal details and government ID\n• Lv.2 - enhanced due diligence: live biometric facial selfie and officer review\n\nYou can see the live status of each level, any rejection reason, and re-submit from your Verification page.",
    links: [{ label: "Open Verification", to: "/profile/verification" }],
  },
  funds: {
    text:
      "Deposit and withdrawal status is shown in real time on your Assets page:\n\n• Pending - awaiting network confirmations or desk review\n• Completed - credited to or sent from your wallet\n• Rejected - funds returned with a reason attached\n\nOpen Transaction History and search by asset, type or TXID.",
    links: [
      { label: "Open Assets", to: "/wallet" },
      { label: "View Portfolio", to: "/portfolio" },
    ],
  },
  password: {
    text:
      "To change your password while signed in, go to Security and choose Change Password. If you are locked out, use \"Forgot password\" on the sign-in screen and follow the emailed link.\n\nFor your protection, withdrawals may be paused for a short period after a password change.",
    links: [{ label: "Open Security Settings", to: "/profile/security" }],
  },
  vip: {
    text:
      "The VIP Account Desk handles priority requests, fee schedules and relationship manager assignments.\n\nCheck your progress toward VIP eligibility, or contact your dedicated manager once VIP is active.",
    links: [{ label: "Open VIP Upgrade", to: "/vip-upgrade" }],
  },
};

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

const SUPPORT_GREETING = "👋 You've reached VelocityTrades Support. What can I help you with?";
const LANGUAGE_KEY = "velocity:support-language";

function readBotLog(ctx: unknown): { id: string; role: "bot" | "user"; text: string; answerId?: string }[] {
  const list = (ctx as { messages?: { role?: string; text?: string; answerId?: string }[] } | null)?.messages;
  if (!Array.isArray(list)) return [];
  return list
    .filter((m) => typeof m?.text === "string")
    .map((m, i) => ({
      id: `saved-${i}`,
      role: m.role === "user" ? ("user" as const) : ("bot" as const),
      answerId: typeof m.answerId === "string" ? m.answerId : undefined,
      /* Refresh legacy personalized greetings in restored transcripts. */
      text: typeof m.text === "string" ? supportPrompt("en", m.text) : "",
    }));
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
  links?: BotLink[];
  answerId?: string;
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
function TopicGrid({ onPick, language }: { onPick: (topicId: BotTopicId) => void; language: SupportLanguage }) {
  return (
    <div className="mt-2.5 w-full">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {supportText(language, "topics")}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {BOT_TOPICS.map((t, index) => {
          const Icon = TOPIC_META[t.id].icon;
          return (
            <Button
              variant="ghost"
              key={t.id}
              onClick={() => onPick(t.id)}
              className="group flex h-auto min-h-20 whitespace-normal touch-manipulation items-start gap-2.5 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-secondary/50"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-secondary text-foreground transition-colors group-hover:border-primary/40 group-hover:text-primary">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold leading-4 text-foreground">{supportTopicLabel(language, index)}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {supportTopicLabel(language, index)}
                </span>
              </span>
            </Button>
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
  initialAction,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Fired once when the widget opens: "agent" pre-selects Talk to Human Agent, "vip-desk" routes to the VIP Priority Operations Desk. */
  initialAction?: "agent" | "vip-desk";
}) {
  const [language, setLanguage] = useState<SupportLanguage>("en");
  const t = (key: SupportKey, values?: Record<string, string>) => supportText(language, key, values);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      const selected = SUPPORT_LANGUAGES.find((item) => item.id === saved);
      if (selected) setLanguage(selected.id);
    } catch { /* Language switching still works without browser storage. */ }
  }, []);
  function selectLanguage(value: string) {
    const selected = SUPPORT_LANGUAGES.find((item) => item.id === value);
    if (!selected) return;
    setLanguage(selected.id);
    try { localStorage.setItem(LANGUAGE_KEY, selected.id); } catch { /* Optional persistence. */ }
  }
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
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const escalatingRef = useRef(false);
  const pendingEscalationRef = useRef(false);
  const sendLockRef = useRef(false);
  const [ended, setEnded] = useState(false);
  const [csatDone, setCsatDone] = useState(false);
  const [endConfirm, setEndConfirm] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endedByAgent, setEndedByAgent] = useState(false);
  const [history, setHistory] = useState<PastSession[]>([]);
  const endedByMeRef = useRef(false);
  const vipPendingRef = useRef(false);
  type Activity = { kind: string; ref: string; label: string; status: string; amount: string; at: string };
  const [activityOpen, setActivityOpen] = useState(false);
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [attached, setAttached] = useState<Activity | null>(null);

  async function openActivity(v: boolean) {
    setActivityOpen(v);
    if (v && !activity) {
      try {
        setActivity((await getMyRecentActivity()) as Activity[]);
      } catch {
        setActivity([]);
      }
    }
  }

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

  /* Resolve an explicitly selected support thread before opening the global widget.
     Ownership is checked by the scoped query; private bot context never enters the drawer. */
  useEffect(() => {
    if (controlledOpen !== undefined) return;
    let active = true;
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent<{ message?: string; vipManager?: boolean; sessionId?: string }>).detail;
      if (detail?.sessionId) {
        const { data: user } = await supabase.auth.getUser();
        if (!user.user || !active) return;
        const { data: selected } = await supabase.from("chat_sessions").select("id,bot_context,escalated_at,connected_at,status").eq("id", detail.sessionId).eq("user_id", user.user.id).maybeSingle();
        if (!selected || !active) return;
        setMessages([]); setAgent(null); setDraft(""); setFile(null);
        setEnded(selected.status === "closed"); setEndedByAgent(false); setEndConfirm(false); setCsatDone(false);
        endedByMeRef.current = false;
        escalatingRef.current = Boolean(selected.escalated_at);
        pendingEscalationRef.current = false;
        setBotLog(readBotLog(selected.bot_context));
        setMode(selected.escalated_at ? "agent" : "bot");
        setQueuedAt(selected.escalated_at); setConnectedAt(selected.connected_at);
        setSessionId(selected.id);
        void loadHistory(user.user.id, selected.id);
      }
      if (!active) return;
      if (detail?.message) setDraft(detail.message);
      if (detail?.vipManager) vipPendingRef.current = true;
      setOpen(true);
    };
    window.addEventListener("velocity:open-chat", handler);
    return () => { active = false; window.removeEventListener("velocity:open-chat", handler); };
  }, [setOpen, controlledOpen, loadHistory]);

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
      const findOpen = () =>
        supabase
          .from("chat_sessions")
          .select("*")
          .eq("user_id", user.user!.id)
          .neq("status", "closed")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      const { data: existing } = await findOpen();

      if (existing) {
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
      // Another tab may have opened a session at the same moment - reuse it.
      const session = created ?? (await findOpen()).data;
      if (session) {
        setSessionId(session.id);
        void loadHistory(user.user.id, session.id);
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
          bot_context: { messages: botLog.map(({ role, text, answerId }) => ({ role, text, ...(answerId ? { answerId } : {}) })).slice(-60) },
        })
        .eq("id", sessionId);
    }, 600);
    return () => clearTimeout(t);
  }, [botLog, sessionId, mode]);

  useEffect(() => {
    if (!open || mode !== "bot" || botLog.length) return;
    setBotLog([
      {
        id: "greet",
        role: "bot",
        text: SUPPORT_GREETING,
        topics: true,
      },
    ]);
  }, [open, mode, botLog.length]);

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

  const botSay = (text: string, opts?: { chips?: BotChip[]; topics?: boolean; links?: BotLink[]; answerId?: string }) =>
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

  /* "Contact Manager" - route the session to the VIP account manager once it exists. */
  useEffect(() => {
    if (!open || !sessionId || !vipPendingRef.current) return;
    vipPendingRef.current = false;
    escalatingRef.current = true;
    setMode("agent");
    requestManagerChat({ data: { sessionId } })
      .then((res) => {
        setQueuedAt(res.queuedAt);
        setConnectedAt(res.connectedAt);
      })
      .catch(() => {
        escalatingRef.current = false;
        setMode("bot");
      });
  }, [open, sessionId]);

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
    userSay(supportTopicLabel(language, BOT_TOPICS.findIndex((item) => item.id === topicId)));
    botSay(`Here are common ${t.label} questions:`, {
      chips: t.items.map((i) => ({ label: i.q, action: `qa:${i.id}` })),
    });
  }

  function handleQuickAction(id: QuickActionId) {
    if (id === "agent") {
      userSay("Talk to Human Agent");
      void escalate("Talk to Human Agent");
      return;
    }
    const qa = QUICK_ANSWERS[id];
    userSay(t(id));
    botSay(`${qa.text}\n\nDid this answer your question?`, { chips: feedbackChips, links: qa.links, answerId: id });
  }

  /* Fire a pre-selected desk action once when the widget opens. */
  const initialActionFiredRef = useRef(false);
  useEffect(() => {
    if (!open) {
      initialActionFiredRef.current = false;
      return;
    }
    if (!initialAction || initialActionFiredRef.current) return;
    initialActionFiredRef.current = true;
    if (initialAction === "agent") {
      handleQuickAction("agent");
    } else {
      userSay("VIP Account Desk");
      void escalate("VIP Priority Operations Desk");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialAction]);

  function handleChip(chip: BotChip) {
    const [kind, id] = chip.action.split(":");
    if (kind === "agent") {
      // Escalate immediately without echoing the chip label into the thread.
      void escalate();
      return;
    }
    userSay(kind === "qa" ? supportQuestion(language, id, chip.label) : supportPrompt(language, chip.label));
    if (kind === "qa") {
      const qa = findQA(id);
      if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips, answerId: qa.id });
    } else if (kind === "yes") {
      botSay("Glad we could help! Anything else?", { topics: true });
    }
  }

  function botReply(text: string) {
    userSay(text);
    if (wantsAgent(text) || text.toLocaleLowerCase() === t("agent").toLocaleLowerCase()) return void escalate(text);
    const qa = matchQuestion(text);
    if (qa) botSay(`${qa.a}\n\nDid this answer your question?`, { chips: feedbackChips, answerId: qa.id });
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
    // Guard against double dispatch: a type="submit" button fires both its
    // onClick and the form's implicit submit in the same tick.
    if (sendLockRef.current) return;
    if (mode === "bot") {
      const text = draft.trim();
      if (!text) return;
      sendLockRef.current = true;
      setDraft("");
      botReply(text);
      sendLockRef.current = false;
      return;
    }
    const typed = draft.trim();
    const ctxLine = attached
      ? `[${attached.kind}] ${attached.kind === "Deposit" ? "TxHash" : "ID"} ${attached.ref} · ${attached.label} · ${attached.amount} · Status: ${attached.status} · ${new Date(attached.at).toLocaleString()}`
      : "";
    const body = [typed, ctxLine].filter(Boolean).join("\n");
    if ((!body && !file) || !sessionId || sending) return;
    setAttached(null);
    sendLockRef.current = true;
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
      sendLockRef.current = false;
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
      sendLockRef.current = false;
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
    sendLockRef.current = false;
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
        <DialogContent lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="flex h-[78vh] max-w-lg flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">{t("support")}</DialogTitle>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <AgentAvatar src={agent?.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {mode === "bot" ? t("assistant") : (agent?.name ?? t("support"))}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {mode === "bot"
                  ? t("automated")
                  : ended
                    ? t("ended")
                    : agentJoined
                      ? agent?.name
                        ? `${t("assigned")}: ${agent.name}`
                        : t("connected")
                      : t("queued")}
              </p>
            </div>
            {mode === "agent" && agentJoined && !ended && (
              <Popover open={endConfirm} onOpenChange={setEndConfirm}>
                <PopoverTrigger asChild>
                  <button className="shrink-0 touch-manipulation rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-bear/50 hover:text-bear">
                    {t("endChat")}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3">
                  <p className="text-xs leading-5 text-foreground">
                    {t("endConfirm")}
                  </p>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      onClick={() => setEndConfirm(false)}
                      className="touch-manipulation rounded-md border border-border px-3 py-1.5 text-xs"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => void endChat()}
                      disabled={ending}
                      className="touch-manipulation rounded-md bg-bear px-3 py-1.5 text-xs font-semibold text-bear-foreground disabled:opacity-50"
                    >
                      {ending ? t("ending") : t("endSession")}
                    </button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <div className="flex shrink-0 items-center gap-1">
              <DropdownMenu dir="ltr">
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={t("language")} title={t("language")} className="touch-manipulation text-muted-foreground">
                    <Globe />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="z-[80] w-44">
                  <DropdownMenuRadioGroup value={language} onValueChange={selectLanguage}>
                    {SUPPORT_LANGUAGES.map((item) => (
                      <DropdownMenuRadioItem key={item.id} value={item.id} className="min-h-9 touch-manipulation">
                        {item.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" variant="ghost" size="icon" onClick={close} aria-label={t("close")} title={t("close")} className="touch-manipulation text-muted-foreground"><X /></Button>
            </div>
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
                      {b.role === "bot" ? supportPrompt(language, b.text) : b.text}
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
                  label={`${t("sessionEnded")} (${new Date(s.endedAt).toLocaleString([], {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })})`}
                />
              </div>
            ))}
            {history.length > 0 && <Divider label={t("newStarted")} />}
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
                    {b.role === "bot" ? b.answerId ? supportAnswer(language, b.answerId, b.text.replace(/\n\nDid this answer your question\?$/, "")) + "\n\n" + t("feedback") : supportPrompt(language, b.text) : b.text}
                  </div>
                  {b.links && b.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {b.links.map((l) => (
                        <Link
                          key={l.to}
                          to={l.to}
                          onClick={() => setOpen(false)}
                          className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          {supportLink(language, l.to, l.label)} <ArrowUpRight className="size-3" />
                        </Link>
                      ))}
                    </div>
                  )}
                  {b.topics && mode === "bot" && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Quick actions">
                      {QUICK_ACTIONS.map(({ id, label, icon: Icon }) => (
                        <button
                          type="button"
                          key={id}
                          onClick={() => handleQuickAction(id)}
                          className={`inline-flex min-h-9 touch-manipulation items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            id === "agent"
                              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              : "border-border bg-card text-foreground hover:border-primary/60 hover:text-primary"
                          }`}
                        >
                          <Icon className="size-3.5" /> {t(id)}
                        </button>
                      ))}
                    </div>
                  )}
                  {b.topics && mode === "bot" && <TopicGrid onPick={handleTopic} language={language} />}
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
                          {c.action.startsWith("qa:") ? supportQuestion(language, c.action.slice(3), c.label) : supportPrompt(language, c.label)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {mode === "agent" && !ended && (
              <div
                role="status"
                className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs leading-5 ${
                  agentJoined ? "border-bull/40 bg-bull/10" : "border-primary/40 bg-primary/10"
                }`}
              >
                <Headphones className={`mt-0.5 size-3.5 shrink-0 ${agentJoined ? "text-bull" : "text-primary"}`} />
                <span>
                  <strong>
                    {agentJoined
                      ? t("deskAssigned")
                      : t("deskAssigning")}
                  </strong>
                  <br />
                  <span className="text-muted-foreground">
                    {agentJoined
                      ? t("savedInfo")
                      : t("queueInfo")}
                  </span>
                </span>
              </div>
            )}
            {mode === "agent" && threadItems.map((m) => m.id === "__joined" ? (
              <div key="__joined" className="flex items-start gap-2 rounded-md border border-bull/40 bg-bull/10 px-3 py-3 text-xs leading-5 text-foreground">
                <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-bull" />
                <span>
                  <strong>{agent?.name ?? "A support agent"}</strong> ({agent?.role ?? "Support Agent"})
                  {t("joined")}
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
                        <span className="inline-flex items-center gap-0.5"><Check className="size-3" /> {t("sent")}</span>
                      ) : m.read_at ? (
                        <span className="inline-flex items-center gap-0.5"><CheckCheck className="size-3" /> {t("read")}</span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5"><CheckCheck className="size-3" /> {t("delivered")}</span>
                      ))}
                  </span>
                </div>
                {m.sender_role === "user" && <UserAvatar className="size-7" alt="You" />}
              </div>
            ))}
            {mode === "agent" && !ended && agentJoined && typing.peerTyping && (
              <p className="px-1 text-xs italic text-muted-foreground">{agent?.name ?? "Agent"} {t("typing")}</p>
            )}
            {mode === "agent" && ended && (
              <div className="flex items-start gap-2 rounded-md border border-border bg-secondary/60 px-3 py-3 text-xs leading-5 text-foreground">
                <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                {endedByAgent ? (
                  <span>
                    <strong>{t("agentEnded")}</strong> • {t("ended")}
                  </span>
                ) : (
                  <span>
                    <strong>{t("sessionEnded")}</strong> • {t("ticketClosed")}
                  </span>
                )}
              </div>
            )}
            {mode === "agent" && ended && (agentJoined || endedByAgent) && !csatDone && sessionId && (
              <CsatCard
                sessionId={sessionId}
                language={language}
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
              <span>{t("urgent")}</span>
              <button
                type="button"
                onClick={() => void escalate()}
                className="touch-manipulation font-semibold text-primary hover:underline"
              >
                {t("connect")}
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
                {t("new")}
              </button>
            </div>
          ) : (
            <form
              className="flex w-full flex-wrap items-end gap-2 border-t border-border p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              {file && (
                <span className="flex w-full items-center gap-2 rounded-md bg-secondary px-2 py-1 text-[11px]">
                  <Paperclip className="size-3" />
                  <span className="truncate">{file.name}</span>
                  <button type="button" onClick={() => setFile(null)} aria-label={t("removeAttachment")}>
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
              {attached && (
                <span className="flex w-full items-center gap-2 rounded-md bg-secondary px-2 py-1 text-[11px]">
                  <History className="size-3" />
                  <span className="truncate">{attached.kind} · {attached.amount} · {attached.status}</span>
                  <button type="button" onClick={() => setAttached(null)} aria-label={t("removeActivity")}>
                    <X className="size-3" />
                  </button>
                </span>
              )}
              {mode !== "bot" && (
                <Popover open={activityOpen} onOpenChange={(v) => void openActivity(v)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("activity")}
                      title={t("activity")}
                      className="grid size-9 shrink-0 touch-manipulation place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                    >
                      <History className="size-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="max-h-72 w-80 overflow-y-auto p-1">
                    <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {t("activity")}
                    </p>
                    {activity === null && <p className="px-2 py-2 text-xs text-muted-foreground">{t("loading")}</p>}
                    {activity?.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">{t("emptyActivity")}</p>}
                    {activity?.map((a) => (
                      <button
                        key={`${a.kind}-${a.ref}`}
                        type="button"
                        onClick={() => {
                          setAttached(a);
                          setActivityOpen(false);
                        }}
                        className="w-full touch-manipulation rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
                      >
                        <span className="font-semibold">{a.kind}</span> · <span className="num">{a.amount}</span> · {a.status}
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {a.label} · {a.ref.slice(0, 18)} · {new Date(a.at).toLocaleString()}
                        </span>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
              <button
                type="button"
                hidden={mode === "bot"}
                onClick={() => fileRef.current?.click()}
                aria-label={t("attach")}
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
                placeholder={mode === "bot" ? t("ask") : t("message")}
                maxLength={4000}
                className="rounded-md bg-secondary px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                aria-label={t("send")}
                className="grid size-9 shrink-0 touch-manipulation place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
                disabled={sending || (!draft.trim() && !file)}
              >
                <Send className="size-4" />
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {rating && sessionId && (
        <RatingModal
          language={language}
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
function RatingModal({ sessionId, onClose, language }: { sessionId: string; onClose: () => void; language: SupportLanguage }) {
  const t = (key: SupportKey, values?: Record<string, string>) => supportText(language, key, values);
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
        <h3 className="font-display text-base font-bold tracking-tight">{t("rate")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("rateHelp")}
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
          placeholder={t("optional")}
          className="mt-4 w-full resize-none rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 touch-manipulation rounded-md border border-border py-2 text-sm"
          >
            {t("notNow")}
          </button>
          <button
            onClick={submit}
            disabled={!stars || busy}
            className="flex-1 touch-manipulation rounded-md bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("submit")}
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
  language,
  onDone,
}: {
  sessionId: string;
  agentName: string;
  language: SupportLanguage;
  onDone: () => void;
}) {
  const t = (key: SupportKey, values?: Record<string, string>) => supportText(language, key, values);
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
        {t("experience", { name: agentName })}
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
        placeholder={t("optional")}
        className="mt-3 w-full resize-none rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="mt-3 flex gap-2">
        <button
          onClick={onDone}
          className="flex-1 touch-manipulation rounded-md border border-border py-2 text-xs"
        >
          {t("skip")}
        </button>
        <button
          onClick={submit}
          disabled={!stars || busy}
          className="flex-1 touch-manipulation rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? t("submitting") : t("submitFeedback")}
        </button>
      </div>
    </div>
  );
}
