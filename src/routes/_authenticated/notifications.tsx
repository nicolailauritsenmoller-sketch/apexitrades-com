import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AlertTriangle, CheckCheck, Info, MessageSquareText, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getActiveAnnouncements, type Announcement } from "@/lib/announcements.functions";
import { useHasSession } from "@/lib/use-session";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Velocity Trade" },
      {
        name: "description",
        content:
          "Your Velocity Trade message center: account alerts, trade updates and platform announcements in one place.",
      },
      { property: "og:title", content: "Notifications — Velocity Trade" },
      {
        property: "og:description",
        content: "Account alerts, trade updates and platform announcements in one place.",
      },
    ],
  }),
  component: NotificationsPage,
});

type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const SEVERITY_ICON: Record<Announcement["severity"], typeof Info> = {
  info: Info,
  warning: AlertTriangle,
  critical: ShieldAlert,
};

function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hasSession = useHasSession();
  const fetchAnnouncements = useServerFn(getActiveAnnouncements);
  const announcements = useQuery({
    queryKey: ["announcements-active"],
    queryFn: () => fetchAnnouncements(),
    enabled: hasSession === true,
    retry: false,
    staleTime: 60_000,
  });

  const load = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notification[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) {
        setLoading(false);
        return;
      }
      setUserId(uid);
      load(uid);

      channel = supabase
        .channel(`notifications-page-${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
          () => load(uid),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    if (!userId) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? now } : n)));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .eq("id", id)
      .is("read_at", null);
  }

  async function markAllRead() {
    if (!userId) return;
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", userId)
      .in("id", ids);
  }

  function toggle(n: Notification) {
    setExpanded((cur) => (cur === n.id ? null : n.id));
    if (!n.read_at) void markRead(n.id);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl touch-manipulation space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
              Notifications
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread message${unread === 1 ? "" : "s"}` : "You're all caught up"}
            </p>
          </div>
          <button
            onClick={markAllRead}
            disabled={unread === 0}
            className="inline-flex touch-manipulation items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary disabled:opacity-40"
          >
            <CheckCheck className="size-4" />
            Mark all as read
          </button>
        </header>

        {(announcements.data ?? []).length > 0 && (
          <section className="space-y-2">
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Announcements
            </h2>
            {(announcements.data ?? []).map((a) => {
              const Icon = SEVERITY_ICON[a.severity] ?? Info;
              return (
                <article
                  key={a.id}
                  className="flex touch-manipulation items-start gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{a.body}</p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </p>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <section className="space-y-2">
          <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground">Messages</h2>

          {loading && (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading messages…
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <MessageSquareText className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">No messages yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Account alerts and trade updates will appear here.
              </p>
            </div>
          )}

          {items.map((n) => {
            const isUnread = !n.read_at;
            const isOpen = expanded === n.id;
            return (
              <button
                key={n.id}
                onClick={() => toggle(n)}
                className={`flex w-full touch-manipulation items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  isUnread
                    ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                    : "border-border bg-card hover:bg-secondary/50"
                }`}
              >
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    isUnread ? "bg-[#FCD535]" : "bg-transparent"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3">
                    <span
                      className={`truncate text-sm ${
                        isUnread ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                      }`}
                    >
                      {n.title}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                  <span
                    className={`mt-1 block text-xs ${
                      isOpen ? "text-foreground" : "line-clamp-2 text-muted-foreground"
                    }`}
                  >
                    {n.body}
                  </span>
                  {n.kind ? (
                    <span className="mt-2 inline-block rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {n.kind}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </section>
      </div>
    </AppShell>
  );
}
