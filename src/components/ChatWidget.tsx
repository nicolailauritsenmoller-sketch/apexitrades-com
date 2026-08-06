import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Message = {
  id: string;
  session_id: string;
  sender_role: string;
  body: string;
  created_at: string;
};

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Other surfaces (e.g. the closed-trade summary) can request support chat.
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
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Message]),
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  async function send() {
    const body = draft.trim();
    if (!body || !sessionId || sending) return;
    setSending(true);
    setDraft("");
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      setSending(false);
      return;
    }
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      sender_id: user.user.id,
      sender_role: "user",
      body,
    });
    await supabase
      .from("chat_sessions")
      .update({ last_message_at: new Date().toISOString(), status: "open" })
      .eq("id", sessionId);
    setSending(false);
  }

  return (
    <>
      {open && (
        <div className="fixed bottom-24 right-4 z-50 flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:bottom-20">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Customer support</p>
              <p className="text-[11px] text-muted-foreground">We typically reply in minutes</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

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
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-border p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              maxLength={1000}
              className="flex-1 rounded-md bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={send}
              aria-label="Send message"
              className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
              disabled={sending}
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      <button
        data-chat-toggle
        onClick={() => setOpen((v) => !v)}
        aria-label="Live chat"
        className="fixed bottom-20 right-4 z-50 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-xl transition-transform hover:scale-105 md:bottom-6"
      >
        <MessageCircle className="size-5" />
      </button>
    </>
  );
}
