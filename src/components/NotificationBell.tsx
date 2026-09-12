import { useCallback, useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Header entry point to the notification center.
 * Shows an amber pill with the number of unread messages and links to /notifications.
 */
export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  const load = useCallback(async (uid: string) => {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .is("read_at", null);
    setUnread(count ?? 0);
  }, []);

  useEffect(() => {
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      load(uid);

      channel = supabase
        .channel(`notifications-badge-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => load(uid),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [load]);

  return (
    <Link
      to="/notifications"
      aria-label={unread > 0 ? `Messages, ${unread} unread` : "Messages"}
      className="relative flex size-9 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      <MessageSquareText className="size-4" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[18px] place-items-center rounded-full bg-[#FCD535] px-1 text-[10px] font-bold leading-none text-[#12161C]">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Link>
  );
}
