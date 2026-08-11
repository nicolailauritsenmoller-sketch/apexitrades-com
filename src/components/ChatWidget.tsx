import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Send,
  X,
  Maximize2,
  Minimize2,
  GripVertical,
  Paperclip,
  Check,
  CheckCheck,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ChatAttachment } from "@/components/chat/ChatAttachment";
import { getMyChatContext, submitChatRating } from "@/lib/desk.functions";
import brandLogo from "@/assets/velocity-trade-logo.png";

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

type Point = { x: number; y: number };

const STORAGE_KEY = "velocity:chat-position";
const RATED_KEY = "velocity:chat-rated";
const BUTTON_SIZE = 52;
const MARGIN = 12;

/** Platform logo used as the default face of every support agent. */
function AgentAvatar({ src, className = "size-8" }: { src?: string | null; className?: string }) {
  return (
    <img
      src={src || brandLogo}
      alt="Velocity Trade support"
      className={`${className} shrink-0 rounded-full border border-border bg-background object-cover p-0.5`}
    />
  );
}


function clampToViewport(p: Point, w: number, h: number): Point {
  const maxX = Math.max(MARGIN, window.innerWidth - w - MARGIN);
  const maxY = Math.max(MARGIN, window.innerHeight - h - MARGIN);
  return {
    x: Math.min(Math.max(p.x, MARGIN), maxX),
    y: Math.min(Math.max(p.y, MARGIN), maxY),
  };
}

/** Draggable launcher + chat panel with a compact / full-screen toggle. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [pos, setPos] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [agent, setAgent] = useState<Agent>(null);
  const [rating, setRating] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragState = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  /* ---------------- positioning ---------------- */

  useEffect(() => {
    const stored = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Point) : null;
      } catch {
        return null;
      }
    })();
    const fallback: Point = {
      x: window.innerWidth - BUTTON_SIZE - 16,
      y: window.innerHeight - BUTTON_SIZE - 88,
    };
    setPos(clampToViewport(stored ?? fallback, BUTTON_SIZE, BUTTON_SIZE));
  }, []);

  useEffect(() => {
    const onResize = () => setPos((p) => (p ? clampToViewport(p, BUTTON_SIZE, BUTTON_SIZE) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!pos) return;
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragState.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y, moved: false };
      setDragging(true);
    },
    [pos],
  );

  const onDragMove = useCallback((e: React.PointerEvent) => {
    const st = dragState.current;
    if (!st) return;
    st.moved = true;
    setPos(
      clampToViewport({ x: e.clientX - st.dx, y: e.clientY - st.dy }, BUTTON_SIZE, BUTTON_SIZE),
    );
  }, []);

  const endDrag = useCallback(() => {
    const st = dragState.current;
    dragState.current = null;
    setDragging(false);
    setPos((p) => {
      if (p) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        } catch {
          /* storage unavailable */
        }
      }
      return p;
    });
    return st?.moved ?? false;
  }, []);

  /* ---------------- chat data ---------------- */

  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      const detail = (e as CustomEvent<{ message?: string }>).detail;
      if (detail?.message) setDraft(detail.message);
    };
    window.addEventListener("velocity:open-chat", handler);
    return () => window.removeEventListener("velocity:open-chat", handler);
  }, []);

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

    const channel = supabase
      .channel(`chat-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Agent persona + read receipts for the messages the user has now seen.
  useEffect(() => {
    if (!sessionId || !open) return;
    let active = true;
    const sync = async () => {
      try {
        const res = await getMyChatContext({ data: { sessionId } });
        if (active) setAgent(res.agent as Agent);
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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, full]);

  async function send() {
    const body = draft.trim();
    if ((!body && !file) || !sessionId || sending) return;
    setSending(true);
    setDraft("");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
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

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: user.user.id,
      sender_role: "user",
      body: body || (attachment["attachment_name"] ?? "Attachment"),
      ...attachment,
    });
    await supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", sessionId);
    setSending(false);
  }

  /* ---------------- panel geometry ---------------- */

  const panelStyle: React.CSSProperties = full
    ? {}
    : pos
      ? {
          left: Math.min(
            Math.max(MARGIN, pos.x + BUTTON_SIZE / 2 - 176),
            Math.max(
              MARGIN,
              (typeof window !== "undefined" ? window.innerWidth : 400) - 352 - MARGIN,
            ),
          ),
          top: Math.max(MARGIN, pos.y - 432),
        }
      : { right: 16, bottom: 96 };

  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        {agent?.avatarUrl ? (
          <img src={agent.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-primary">
            <Headset className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{agent?.name ?? "Customer support"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {agent ? `${agent.role} · ID ${agent.staffId}` : "We typically reply in minutes"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setFull((v) => !v)}
          aria-label={full ? "Exit full view" : "Expand to full view"}
          title={full ? "Compact view" : "Full view"}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setFull(false);
            if (messages.length > 0 && localStorage.getItem(RATED_KEY) !== sessionId) {
              setRating(true);
            }
          }}
          aria-label="Close chat"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );

  const thread = (
    <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
      {messages.length === 0 && (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Send us a message and an agent will join shortly.
        </p>
      )}
      {messages.map((m) => (
        <div
          key={m.id}
          className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
            m.sender_role === "user"
              ? "ml-auto bg-primary text-primary-foreground"
              : "bg-secondary text-foreground"
          }`}
        >
          {m.body}
          {m.attachment_path && (
            <ChatAttachment messageId={m.id} name={m.attachment_name} type={m.attachment_type} />
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
      ))}
      <div ref={endRef} />
    </div>
  );

  const composer = (
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
        onClick={() => fileRef.current?.click()}
        aria-label="Attach a photo or document"
        className="grid size-9 shrink-0 touch-manipulation place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Paperclip className="size-4" />
      </button>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Type a message…"
        maxLength={4000}
        rows={full ? 3 : 1}
        className="max-h-40 flex-1 resize-none rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
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
  );

  return (
    <>
      {rating && sessionId && (
        <RatingModal
          sessionId={sessionId}
          onClose={() => {
            localStorage.setItem(RATED_KEY, sessionId);
            setRating(false);
          }}
        />
      )}

      {open && full && (
        <div className="fixed inset-0 z-[80] flex flex-col bg-background sm:p-6">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden border-border bg-card sm:rounded-2xl sm:border sm:shadow-2xl">
            {header}
            {thread}
            {composer}
          </div>
        </div>
      )}

      {open && !full && (
        <div
          style={panelStyle}
          className="fixed z-50 flex h-[27rem] w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          {header}
          {thread}
          {composer}
        </div>
      )}

      {pos && (
        <div
          style={{ left: pos.x, top: pos.y, touchAction: "none" }}
          className={`fixed z-50 ${dragging ? "cursor-grabbing" : ""}`}
        >
          <button
            data-chat-toggle
            onPointerDown={startDrag}
            onPointerMove={onDragMove}
            onPointerUp={(e) => {
              const moved = endDrag();
              if (!moved) setOpen((v) => !v);
              (e.target as Element).releasePointerCapture?.(e.pointerId);
            }}
            onPointerCancel={endDrag}
            aria-label="Live chat — drag to reposition"
            className={`grid size-13 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform ${
              dragging ? "scale-110" : "hover:scale-105"
            }`}
          >
            {open ? <GripVertical className="size-5" /> : <MessageCircle className="size-5" />}
          </button>
        </div>
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
