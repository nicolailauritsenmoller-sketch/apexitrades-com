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
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => { primeComplianceChime(); }, []);
  useEffect(() => {
    if (!q.data) return;
    const previous = seen.current;
    seen.current = new Map(q.data.map(a => [a.user_id, a.status]));
    // New applications and revisions resubmitted after a rejection both count as fresh.
    if (previous === null) return;
    const fresh = q.data.filter(a => (a.status === "pending" || a.status === "review") && previous.get(a.user_id) !== a.status);
    if (fresh.length === 0) return;
    playComplianceChime();
    for (const a of fresh) toast(`New Leaderboard Application Received from ${a.public_name}`, {
      description: previous.get(a.user_id) === "rejected" ? "Resubmitted after a previous decision. Awaiting manual review." : "Awaiting manual review.",
      duration: 12_000,
      action: { label: "Review", onClick: onReview },
    });
  }, [q.data, onReview]);
  return null;
}
