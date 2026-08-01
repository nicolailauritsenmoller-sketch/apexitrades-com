import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Notification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data ?? []) as Notification[]);
  }

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notifications-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.read_at).map((n) => n.id);
    if (ids.length === 0) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    load();
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground">
            Notifications
          </span>
          <button onClick={markAllRead} className="text-[11px] text-primary hover:underline">
            Mark all read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Nothing yet.</p>
          )}
          {items.map((n) => (
            <div
              key={n.id}
              className={`border-b border-border/60 px-3 py-2.5 ${n.read_at ? "" : "bg-secondary/40"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{n.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {new Date(n.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
            </div>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
