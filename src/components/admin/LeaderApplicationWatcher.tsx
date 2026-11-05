import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getLeaderApplications } from "@/lib/leaderboard-posts.functions";
import { playComplianceChime, primeComplianceChime } from "@/lib/compliance-chime";

/** Watches for new leader applications anywhere in the console; toasts and chimes on arrival. */
export function LeaderApplicationWatcher({ onReview }: { onReview: () => void }) {
  const fetchApps = useServerFn(getLeaderApplications);
  const q = useQuery({ queryKey: ["leader-applications"], queryFn: () => fetchApps(), refetchInterval: 5_000, refetchIntervalInBackground: true });
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => { primeComplianceChime(); }, []);
  useEffect(() => {
    if (!q.data) return;
    const pending = q.data.filter(a => (a.status === "pending" || a.status === "review"));
    if (seen.current === null) { seen.current = new Set(pending.map(a => a.user_id + a.created_at)); return; }
    const fresh = pending.filter(a => !seen.current!.has(a.user_id + a.created_at));
    fresh.forEach(a => seen.current!.add(a.user_id + a.created_at));
    if (fresh.length === 0) return;
    playComplianceChime();
    for (const a of fresh) toast(`New Leaderboard Application Received from ${a.public_name}`, {
      description: "Awaiting manual review.", duration: 12_000,
      action: { label: "Review", onClick: onReview },
    });
  }, [q.data, onReview]);
  return null;
}
