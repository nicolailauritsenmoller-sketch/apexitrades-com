import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Headphones,
  Activity,
  CheckCheck,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useHasSession } from "@/lib/use-session";
import { useSupportUnread } from "@/lib/use-support-unread";
import { institutionalizeCopy } from "@/lib/institutional-copy";
import { getActiveAnnouncements } from "@/lib/announcements.functions";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MarketIntelligence, useMarketPulses } from "./MarketIntelligence";
import {
  AlertSettingsDialog,
  categoryOf,
  deliverAlert,
  useAlertPrefs,
  usePriceAlerts,
  useRiskWatcher,
} from "./comms-alerts";
import {
  NOTIFICATION_FILTERS,
  filterLabelOf,
  notificationFilterOf,
  statusLabelOf,
  statusToneOf,
  type NotificationFilter,
} from "./notification-filters";
import { cn } from "@/lib/utils";

function stamp(at: string) {
  return new Date(at).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommunicationsCenter() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("notifications");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [actionError, setActionError] = useState(false);
  const [marking, setMarking] = useState(false);
  const hasSession = useHasSession();
  const unreadChat = useSupportUnread();
  const client = useQueryClient();
  const market = useMarketPulses();
  const prefs = useAlertPrefs();
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const priceAlerts = usePriceAlerts(hasSession === true);
  useRiskWatcher(hasSession === true);
  const unreadAnalytics = market.pulses.filter((p) => !market.seen.has(p.id)).length;
  useEffect(() => {
    if (open && tab === "analytics") market.markSeen(market.pulses.map((p) => p.id));
  }, [open, tab, market.pulses, market.markSeen]);

  const identity = useQuery({
    queryKey: ["communications-identity"],
    enabled: hasSession === true,
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user?.id ?? null;
    },
  });
  const uid = identity.data;
  const notifications = useQuery({
    queryKey: ["communications-notifications", uid],
    enabled: Boolean(uid),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!uid) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,kind,read_at,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
  const unread = useQuery({
    queryKey: ["communications-unread", uid],
    enabled: Boolean(uid),
    refetchInterval: 30_000,
    queryFn: async () => {
      if (!uid) return 0;
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const threads = useQuery({
    queryKey: ["communications-threads", uid],
    enabled: Boolean(uid) && open,
    refetchInterval: open ? 15_000 : false,
    queryFn: async () => {
      if (!uid) return [];
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id,subject,status,last_message_at,department")
        .eq("user_id", uid)
        .order("last_message_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      const ids = (data ?? []).map((s) => s.id);
      if (!ids.length) return [];
      const { data: messages, error: messageError } = await supabase
        .from("chat_messages")
        .select("session_id,body,read_at,sender_role,created_at")
        .in("session_id", ids)
        .eq("is_internal", false)
        .order("created_at", { ascending: false });
      if (messageError) throw messageError;
      return (data ?? [])
        .map((s) => {
          const rows = (messages ?? []).filter(
            (m) =>
              m.session_id === s.id &&
              !m.body.startsWith("[Live agent requested]") &&
              !m.body.includes("Bot transcript:"),
          );
          return {
            ...s,
            preview: rows[0]?.body ?? "",
            unread: rows.filter((m) => m.sender_role !== "user" && !m.read_at).length,
          };
        })
        .filter((s) => s.status !== "closed" || s.preview);
    },
  });
  const fetchAnnouncements = useServerFn(getActiveAnnouncements);
  const announcements = useQuery({
    queryKey: ["announcements-active"],
    queryFn: () => fetchAnnouncements(),
    enabled: hasSession === true && open,
    staleTime: 60_000,
  });

  // Feed filtering: platform bulletins stay with System, every alert row maps to one category.
  const visibleNotifications = (notifications.data ?? []).filter((n) =>
    prefs.enabled(categoryOf(n.kind), "inApp"),
  );
  const feedNotifications =
    filter === "all"
      ? visibleNotifications
      : visibleNotifications.filter((n) => notificationFilterOf(n) === filter);
  const bulletins = filter === "all" || filter === "system" ? (announcements.data ?? []) : [];
  const filterCounts = NOTIFICATION_FILTERS.reduce(
    (acc, f) => {
      acc[f.key] = visibleNotifications.filter(
        (n) => !n.read_at && (f.key === "all" || notificationFilterOf(n) === f.key),
      ).length;
      return acc;
    },
    {} as Record<NotificationFilter, number>,
  );

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`communications-${uid}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` },
        (payload) => {
          if (payload.eventType === "INSERT") deliverAlert(prefsRef.current, payload.new as any);
          void client.invalidateQueries({ queryKey: ["communications-notifications", uid] });
          void client.invalidateQueries({ queryKey: ["communications-unread", uid] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions", filter: `user_id=eq.${uid}` },
        () => {
          void client.invalidateQueries({ queryKey: ["communications-threads", uid] });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => {
        void client.invalidateQueries({ queryKey: ["communications-threads", uid] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, client]);

  async function markRead(id?: string) {
    if (!uid || marking) return;
    setMarking(true);
    setActionError(false);
    let query = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", uid)
      .is("read_at", null);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    setActionError(Boolean(error));
    setMarking(false);
    if (!error) {
      void client.invalidateQueries({ queryKey: ["communications-notifications", uid] });
      void client.invalidateQueries({ queryKey: ["communications-unread", uid] });
    }
  }
  function launch(sessionId?: string) {
    setOpen(false);
    window.setTimeout(
      () => window.dispatchEvent(new CustomEvent("velocity:open-chat", { detail: { sessionId } })),
      100,
    );
  }
  const total = (unread.data ?? 0) + unreadChat + unreadAnalytics;
  const counter = (count: number) =>
    count > 0 ? (
      <span
        aria-live="polite"
        className="ml-1 inline-flex min-w-4 justify-center font-mono text-[10px] font-bold text-alert"
      >
        {count}
      </span>
    ) : null;
  const contentClass =
    "mt-0 min-h-0 flex-1 overflow-y-auto overscroll-contain motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          title="Communications center"
          aria-label={`Communications center${total ? `, ${total} unread` : ""}`}
          className="relative size-9 touch-manipulation text-muted-foreground"
        >
          <Bell />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-alert px-1 text-[9px] font-bold text-background">
              {total}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-dvh w-full flex-col gap-0 p-0 text-foreground sm:w-[460px] sm:max-w-[460px]">
        <SheetHeader className="border-b border-border px-5 pb-4 pt-5 text-left">
          <SheetDescription className="text-[10px] uppercase tracking-widest">
            Velocity Trade
          </SheetDescription>
          <SheetTitle className="pr-6 font-display text-lg">Communications Center</SheetTitle>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <ShieldCheck className="size-3 text-bull" />
            Account & market communications
          </div>
        </SheetHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <TabsList
            aria-label="Communication channels"
            className="grid h-12 shrink-0 grid-cols-3 rounded-none border-b border-border bg-transparent px-3 py-0"
          >
            {[
              {
                value: "notifications",
                label: "Notifications",
                Icon: Bell,
                count: unread.data ?? 0,
              },
              { value: "chat", label: "Chat", Icon: Headphones, count: unreadChat },
              { value: "analytics", label: "Analytics", Icon: Activity, count: unreadAnalytics },
            ].map(({ value, label, Icon, count }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-12 gap-1 rounded-none border-b-2 border-transparent px-1 text-xs data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                <Icon className="hidden size-3.5 min-[380px]:block" />
                {label}
                {counter(count)}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="notifications" className={contentClass}>
            <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
              <div className="flex items-center justify-between gap-2 px-5 pt-3">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {filter === "all" ? "Account activity" : `${filterLabelOf(filter)} activity`}
                </span>
                <div className="flex items-center gap-1">
                  <AlertSettingsDialog />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void markRead()}
                    disabled={!unread.data || marking}
                    className="h-8 touch-manipulation px-2 text-[11px]"
                  >
                    <CheckCheck />
                    {marking ? "Updating..." : "Mark all read"}
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div
                  role="group"
                  aria-label="Filter notifications by category"
                  className="no-scrollbar flex snap-x gap-1 overflow-x-auto px-5 pb-3 pt-2"
                >
                {NOTIFICATION_FILTERS.map(({ key, label }) => {
                  const active = filter === key;
                  const pending = filterCounts[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      aria-pressed={active}
                      className={cn(
                        "flex shrink-0 snap-start touch-manipulation items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-colors",
                        active
                          ? "border-ops-blue/40 bg-ops-blue/10 text-ops-blue"
                          : "border-input text-foreground/70 hover:border-foreground/30 hover:text-foreground",
                      )}
                    >
                      {label}
                      {pending > 0 && (
                        <span className="font-mono text-[10px] font-bold text-alert">
                          {pending}
                        </span>
                      )}
                    </button>
                  );
                })}
                </div>
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background via-background/60 to-transparent"
                />
              </div>
            </div>
            {actionError && (
              <p role="alert" className="px-5 py-2 text-xs text-alert">
                Unable to mark alerts read. Please try again.
              </p>
            )}
            {(notifications.isError || identity.isError || announcements.isError) && (
              <p role="alert" className="p-5 text-xs text-alert">
                Unable to load communications.{" "}
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    void notifications.refetch();
                    void identity.refetch();
                    void announcements.refetch();
                  }}
                >
                  Retry
                </Button>
              </p>
            )}
            {notifications.isPending && (
              <p className="p-5 text-xs text-muted-foreground">Loading account alerts...</p>
            )}
            {bulletins.map((a) => (
              <article key={a.id} className="border-b border-border bg-secondary/30 px-5 py-4">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Platform bulletin
                </p>
                <p className="text-sm font-semibold">{institutionalizeCopy(a.title)}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {institutionalizeCopy(a.body)}
                </p>
              </article>
            ))}
            {!notifications.isPending && !notifications.isError && !feedNotifications.length && (
              <Empty
                title={
                  filter === "all"
                    ? "No account alerts"
                    : `No ${filterLabelOf(filter).toLowerCase()} alerts`
                }
              />
            )}
            {feedNotifications.map((n) => (
              <Button
                key={n.id}
                variant="ghost"
                onClick={() => {
                  setExpanded(expanded === n.id ? null : n.id);
                  if (!n.read_at) void markRead(n.id);
                }}
                aria-expanded={expanded === n.id}
                className="flex h-auto w-full items-start justify-start whitespace-normal rounded-none border-b border-border px-5 py-4 text-left"
              >
                <span
                  className={`mt-1.5 size-1.5 shrink-0 rounded-full ${n.read_at ? "bg-muted" : "bg-alert"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="mb-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] font-normal text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider",
                        statusToneOf(n.kind),
                      )}
                    >
                      {statusLabelOf(n.kind)}
                    </span>
                    <time>{stamp(n.created_at)}</time>
                  </span>
                  <span className={`block text-sm ${!n.read_at ? "font-semibold" : "font-medium"}`}>
                    {institutionalizeCopy(n.title)}
                  </span>
                  <span
                    className={`mt-1 block text-xs font-normal leading-relaxed text-foreground/75 ${expanded === n.id ? "" : "line-clamp-2"}`}
                  >
                    {institutionalizeCopy(n.body)}
                  </span>
                </span>
              </Button>
            ))}
            <Button asChild variant="ghost" className="my-3 w-full text-xs">
              <Link to="/notifications" onClick={() => setOpen(false)}>
                View full history
                <ArrowUpRight />
              </Link>
            </Button>
          </TabsContent>
          <TabsContent value="chat" className={contentClass}>
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Support conversations
              </span>
              <Button variant="outline" size="sm" onClick={() => launch()} className="text-[11px]">
                <Headphones />
                Contact support
              </Button>
            </div>
            {threads.isPending && (
              <p className="p-5 text-xs text-muted-foreground">Loading conversations...</p>
            )}
            {threads.isError && (
              <p role="alert" className="p-5 text-xs text-alert">
                Unable to load conversations.{" "}
                <Button variant="link" onClick={() => void threads.refetch()}>
                  Retry
                </Button>
              </p>
            )}
            {!threads.isPending && !threads.isError && !threads.data?.length && (
              <Empty title="No support conversations" />
            )}
            {(threads.data ?? []).map((s) => (
              <Button
                key={s.id}
                variant="ghost"
                onClick={() => launch(s.id)}
                className="h-auto w-full items-start justify-start whitespace-normal rounded-none border-b border-border px-5 py-4 text-left"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-secondary">
                  <Headphones />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-sm font-semibold">
                    {institutionalizeCopy(s.subject || "Institutional Support")}
                    {counter(s.unread)}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs font-normal leading-relaxed text-muted-foreground">
                    {institutionalizeCopy(s.preview) || "Support inquiry"}
                  </span>
                  <span className="mt-2 flex flex-wrap gap-2 text-[10px] font-normal text-muted-foreground">
                    <span className={s.status === "closed" ? "" : "text-bull"}>
                      {s.status === "closed" ? "Closed" : "Active"}
                    </span>
                    <time>{stamp(s.last_message_at)}</time>
                  </span>
                </span>
                <ChevronRight className="mt-2 text-muted-foreground" />
              </Button>
            ))}
          </TabsContent>
          <TabsContent value="analytics" className={contentClass}>
            <MarketIntelligence market={market} priceAlerts={priceAlerts} />
          </TabsContent>
        </Tabs>
        <footer className="shrink-0 border-t border-border px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-[10px] text-muted-foreground">
          {tab === "analytics"
            ? "Market data refreshed every 5s. Intelligence is not investment advice."
            : "Private communications · Velocity Trade"}
        </footer>
      </SheetContent>
    </Sheet>
  );
}

function Empty({ title }: { title: string }) {
  return (
    <div className="px-5 py-12 text-center">
      <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
    </div>
  );
}
