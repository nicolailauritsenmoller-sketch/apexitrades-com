import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { heartbeat } from "@/lib/sessions";

/**
 * Pings the user's presence (page + last-seen) every 45s so the operations
 * console can list who is currently online and what they are looking at.
 */
export function usePresenceHeartbeat() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      const ping = () => void heartbeat(userId, pathRef.current);
      ping();
      timer = setInterval(ping, 45_000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!cancelled && data.user?.id) void heartbeat(data.user.id, pathname);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);
}
