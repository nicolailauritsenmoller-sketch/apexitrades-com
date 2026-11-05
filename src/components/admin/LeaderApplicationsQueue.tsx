import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getLeaderApplications, reviewLeaderApplication } from "@/lib/leaderboard-posts.functions";

const TONE: Record<string, string> = { pending: "text-ops-amber", approved: "text-ops-emerald", rejected: "text-ops-red" };
const LABEL: Record<string, string> = { pending: "Pending Review", review: "In Review", approved: "Approved", rejected: "Rejected" };

export function LeaderApplicationsQueue() {
  const qc = useQueryClient();
  const fetchApps = useServerFn(getLeaderApplications), review = useServerFn(reviewLeaderApplication);
  const q = useQuery({ queryKey: ["leader-applications"], queryFn: () => fetchApps(), refetchInterval: 15_000 });
  const act = useMutation({
    mutationFn: (v: { userId: string; action: "approve" | "reject" }) => review({ data: v }),
    onSuccess: r => { toast.success(r.status === "approved" ? "Application approved" : "Application rejected"); void qc.invalidateQueries({ queryKey: ["leader-applications"] }); void qc.invalidateQueries({ queryKey: ["leaderboard-manager"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const apps = q.data ?? [];
  const pending = apps.filter(a => a.status === "pending").length;
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold">Leader applications <span className="ml-1 font-mono text-xs text-muted-foreground">{pending} pending</span></h3>
    {q.isPending ? <p className="text-xs text-muted-foreground">Loading...</p> : apps.length === 0 ? <p className="text-xs text-muted-foreground">No applications submitted.</p> :
      <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-xs">
        <thead className="bg-surface text-left text-muted-foreground"><tr><th className="p-2">Trader name</th><th className="p-2">Strategy</th><th className="p-2">Last submitted</th><th className="p-2">Status</th><th className="p-2 text-right">Actions</th></tr></thead>
        <tbody>{apps.map(a => <tr key={a.user_id} className="border-t border-border">
          <td className="p-2 font-medium">{a.public_name}</td>
          <td className="max-w-xs truncate p-2 text-muted-foreground">{a.bio || "-"}</td>
          <td className="p-2 font-mono">{new Date(a.updated_at).toLocaleString()}</td>
          <td className={`p-2 font-mono uppercase ${TONE[a.status] ?? ""}`}>{LABEL[a.status] ?? a.status}</td>
          <td className="space-x-2 p-2 text-right">
            {a.status !== "approved" && <Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ userId: a.user_id, action: "approve" })}>Approve</Button>}
            {a.status !== "rejected" && <Button size="sm" variant="outline" disabled={act.isPending} onClick={() => act.mutate({ userId: a.user_id, action: "reject" })}>Reject</Button>}
          </td>
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
