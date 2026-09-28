import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Unread agent messages across every support session of the signed-in user.
 * Marks messages as delivered as soon as the app sees them, and exposes a
 * shared count so every support entry point can show a badge.
 */
let listeners = new Set<(n: number) => void>();
let current = 0;
function publish(n: number) {
  current = n;
  listeners.forEach((l) => l(n));
}

export async function refreshSupportUnread() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return publish(0);
  const { data: sessions } = await supabase.from("chat_sessions").select("id").eq("user_id", u.user.id);
  const ids = (sessions ?? []).map((s) => s.id);
  if (!ids.length) return publish(0);
  const { data: rows } = await supabase
    .from("chat_messages")
    .select("id, delivered_at")
    .in("session_id", ids)
    .neq("sender_role", "user")
    .is("read_at", null);
  const undelivered = (rows ?? []).filter((r) => !r.delivered_at).map((r) => r.id);
  if (undelivered.length) {
    await supabase
      .from("chat_messages")
      .update({ delivered_at: new Date().toISOString() })
      .in("id", undelivered);
  }
  publish(rows?.length ?? 0);
}

/** Mark every agent message in the user's support history as read. */
export async function markAllSupportRead() {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { data: sessions } = await supabase.from("chat_sessions").select("id").eq("user_id", u.user.id);
  const ids = (sessions ?? []).map((s) => s.id);
  if (!ids.length) return publish(0);
  const now = new Date().toISOString();
  await supabase
    .from("chat_messages")
    .update({ read_at: now, delivered_at: now })
    .in("session_id", ids)
    .neq("sender_role", "user")
    .is("read_at", null);
  publish(0);
}

export function useSupportUnread() {
  const [count, setCount] = useState(current);
  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);
  return count;
}

/** Mount once (AppShell): keeps the unread count live via realtime. */
export function useSupportUnreadSync() {
  const refresh = useCallback(() => void refreshSupportUnread(), []);
  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`support-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, refresh)
      .subscribe();
    const t = setInterval(refresh, 60_000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [refresh]);
}

export function UnreadDotClass() {
  return "absolute -right-1 -top-1 grid min-w-4 h-4 place-items-center rounded-full bg-bear px-1 text-[10px] font-bold leading-none text-bear-foreground";
}
