import { useEffect, useMemo, useState } from "react";
import { Headset, CheckCheck } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  NOTIFICATION_FILTERS,
  notificationFilterOf,
  type NotificationFilter,
} from "@/components/communications/notification-filters";

const READ_KEY = "velocity:ops-notif-read-at";
const QK = ["ops-notifications-center"];

type OpsItem = {
  id: string;
  title: string;
  body: string;
  at: string;
  filter: Exclude<NotificationFilter, "all">;
  /** Staff-addressed rows in `notifications` carry server-side read state. */
  ownId?: string;
  readAt?: string | null;
};

function amt(v: unknown) {
  return Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

async function loadFeed(): Promise<OpsItem[]> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  const db = supabase as any;
  const q = (t: string, cols: string) =>
    db.from(t).select(cols).gte("created_at", since).order("created_at", { ascending: false }).limit(25);
  const [own, dep, wd, tickets, contracts, kyc, sec] = await Promise.all([
    uid
      ? db.from("notifications").select("id,title,body,kind,created_at,read_at").eq("user_id", uid)
          .gte("created_at", since).order("created_at", { ascending: false }).limit(40)
      : Promise.resolve({ data: [] }),
    q("deposits", "id,amount,coin,status,created_at").eq("status", "pending"),
    q("withdrawals", "id,amount,coin,status,created_at").eq("status", "pending"),
    q("support_tickets", "id,subject,priority,status,created_at"),
    q("contracts", "id,symbol,display_symbol,direction,stake,currency,created_at"),
    q("kyc_submissions", "id,full_name,country,status,created_at").eq("status", "pending"),
    q("security_logs", "id,event,detail,ip_address,created_at"),
  ]);
  const items: OpsItem[] = [];
  for (const r of own.data ?? [])
    items.push({ id: `n:${r.id}`, ownId: r.id, readAt: r.read_at, title: r.title, body: r.body, at: r.created_at,
      filter: notificationFilterOf(r) as OpsItem["filter"] });
  for (const r of dep.data ?? [])
    items.push({ id: `d:${r.id}`, title: "New deposit awaiting clearing", body: `${amt(r.amount)} ${r.coin} pending review`, at: r.created_at, filter: "financial" });
  for (const r of wd.data ?? [])
    items.push({ id: `w:${r.id}`, title: "Withdrawal awaiting approval", body: `${amt(r.amount)} ${r.coin} pending review`, at: r.created_at, filter: "financial" });
  for (const r of tickets.data ?? [])
    items.push({ id: `t:${r.id}`, title: "Support ticket activity", body: `${r.subject ?? "Ticket"} - ${r.priority ?? "normal"} - ${r.status ?? "open"}`, at: r.created_at, filter: "system" });
  for (const r of contracts.data ?? [])
    items.push({ id: `c:${r.id}`, title: "Scalp contract opened", body: `${r.display_symbol ?? r.symbol} ${String(r.direction ?? "").toUpperCase()} - ${amt(r.stake)} ${r.currency ?? ""}`, at: r.created_at, filter: "trades" });
  for (const r of kyc.data ?? [])
    items.push({ id: `k:${r.id}`, title: "KYC submission awaiting review", body: `${r.full_name ?? "A user"}${r.country ? ` - ${r.country}` : ""}`, at: r.created_at, filter: "security" });
  for (const r of sec.data ?? [])
    items.push({ id: `s:${r.id}`, title: String(r.event).replace(/[._]/g, " "), body: r.detail ?? "Security event recorded", at: r.created_at, filter: "security" });
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 120);
}

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Operations Console notifications center: live operational alerts with filters and read state. */
export function AdminNotificationsCenter() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<NotificationFilter>("all");
  const [readAt, setReadAt] = useState("1970-01-01T00:00:00Z");
  const { data = [] } = useQuery({ queryKey: QK, queryFn: loadFeed, refetchInterval: 30_000 });

  useEffect(() => {
    const v = localStorage.getItem(READ_KEY);
    if (v) setReadAt(v);
    const onStorage = (e: StorageEvent) => e.key === READ_KEY && e.newValue && setReadAt(e.newValue);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const ch = supabase.channel(`ops-notif-${Math.random().toString(36).slice(2)}`);
    for (const t of ["notifications", "deposits", "withdrawals", "support_tickets", "contracts", "kyc_submissions", "security_logs"])
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => qc.invalidateQueries({ queryKey: QK }));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const isUnread = (i: OpsItem) => (i.ownId ? !i.readAt : i.at > readAt);
  const unread = data.filter(isUnread).length;
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const i of data) if (isUnread(i)) { c.all++; c[i.filter] = (c[i.filter] ?? 0) + 1; }
    return c;
  }, [data, readAt]);
  const shown = tab === "all" ? data : data.filter((i) => i.filter === tab);

  async function markAllRead() {
    const now = new Date().toISOString();
    localStorage.setItem(READ_KEY, now);
    setReadAt(now);
    const ids = data.filter((i) => i.ownId && !i.readAt).map((i) => i.ownId!);
    if (ids.length) await (supabase as any).from("notifications").update({ read_at: now }).in("id", ids);
    qc.invalidateQueries({ queryKey: QK });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          title="Notifications center"
          className="relative grid size-9 touch-manipulation place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Headset className="size-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,400px)] p-0">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
          <p className="font-display text-sm font-semibold">Notifications</p>
          <button
            onClick={markAllRead}
            disabled={!unread}
            className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-primary hover:bg-secondary disabled:opacity-40"
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-border/70 px-2 py-1.5">
          {NOTIFICATION_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setTab(f.key)}
              className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                tab === f.key ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
              {counts[f.key] ? <span className="ml-1 text-alert">{counts[f.key]}</span> : null}
            </button>
          ))}
        </div>
        <ul className="max-h-[60vh] overflow-y-auto">
          {shown.length === 0 && (
            <li className="px-3 py-8 text-center text-xs text-muted-foreground">No operational alerts in the last 7 days.</li>
          )}
          {shown.map((i) => (
            <li key={i.id} className="flex gap-2 border-b border-border/40 px-3 py-2.5 last:border-0">
              <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${isUnread(i) ? "bg-primary" : "bg-transparent"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-xs capitalize-first ${isUnread(i) ? "font-semibold" : "text-muted-foreground"}`}>{i.title}</p>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ago(i.at)}</span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{i.body}</p>
                <span className="mt-1 inline-block text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/80">{i.filter}</span>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
