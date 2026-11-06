import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getActiveDesk } from "@/lib/active-desk.functions";
import { activitySnapshot, newlyActiveSessions } from "@/lib/user-activity-events";
import { playUserActivityChime, primeUserActivityChime } from "@/lib/user-activity-chime";

/** Mounted once across all console sections, using the same heartbeat data as the desk. */
export function UserActivityWatcher() {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getActiveDesk);
  const q = useQuery({
    queryKey: ["active-desk"], queryFn: () => fetchDesk(),
    refetchInterval: 5_000, refetchIntervalInBackground: true,
  });
  const previous = useRef<Map<string, boolean> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => primeUserActivityChime(), []);
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 1_000);
    const channel = supabase.channel(`desk-activity-alerts-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, () => {
        void qc.invalidateQueries({ queryKey: ["active-desk"] });
      }).subscribe();
    return () => {
      clearInterval(ticker);
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  useEffect(() => {
    if (!q.data || q.isError) return;
    const current = activitySnapshot(q.data.rows, Math.max(now, q.dataUpdatedAt));
    const arrivals = newlyActiveSessions(previous.current, current);
    previous.current = current;
    // One motif per update even when several sessions become active together.
    if (arrivals.length) playUserActivityChime();
  }, [q.data, q.dataUpdatedAt, q.isError, now]);
  return null;
}