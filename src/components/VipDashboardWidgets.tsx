import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownToLine, FileText, Lock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const statusTone: Record<string, string> = {
  approved: "text-bull",
  pending: "text-ops-amber",
  rejected: "text-bear",
};

/** Member widgets: own deposit history and newest VIP research reports. */
export function VipDashboardWidgets({ isVip }: { isVip: boolean }) {
  const deposits = useQuery({
    queryKey: ["vip-dash-deposits"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("deposits")
        .select("id,coin,network,amount,status,created_at")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });
  const reports = useQuery({
    queryKey: ["vip-research"],
    enabled: isVip,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vip_research_reports")
        .select("id,title,summary,body,category,created_at")
        .eq("published", true)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const card = "rounded-lg border border-vip-border/40 bg-vip-card p-4";
  return (
    <section aria-label="VIP account widgets" className="grid gap-3 pt-7 sm:grid-cols-2 sm:gap-4">
      <div className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-vip-gold-light"><ArrowDownToLine className="size-4" /> Deposit history</h2>
        {deposits.isLoading ? <p className="text-xs text-vip-muted">Loading...</p>
          : deposits.isError ? <p className="text-xs text-vip-muted">Deposit history unavailable.</p>
          : !deposits.data?.length ? <p className="text-xs text-vip-muted">No deposits yet.</p>
          : <ul className="divide-y divide-border">
              {deposits.data.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                  <span><span className="num font-medium text-vip-title">{Number(d.amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} {d.coin}</span><span className="block text-vip-muted">{d.network} - {new Date(d.created_at).toLocaleDateString()}</span></span>
                  <span className={`font-semibold uppercase ${statusTone[d.status] ?? "text-vip-muted"}`}>{d.status}</span>
                </li>
              ))}
            </ul>}
        <Link to="/wallet" className="mt-2 inline-flex items-center gap-1 text-xs text-vip-muted">All transactions <ChevronRight className="size-3" /></Link>
      </div>
      <div className={card}>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-vip-gold-light"><FileText className="size-4" /> Research reports</h2>
        {!isVip ? <p className="flex items-start gap-2 text-xs text-vip-muted"><Lock className="mt-0.5 size-3.5 shrink-0" /> Available once your VIP membership is active.</p>
          : reports.isLoading ? <p className="text-xs text-vip-muted">Loading...</p>
          : reports.isError ? <p className="text-xs text-vip-muted">Reports unavailable.</p>
          : !reports.data?.length ? <p className="text-xs text-vip-muted">No reports published yet.</p>
          : <ul className="divide-y divide-border">
              {reports.data.slice(0, 3).map((r) => (
                <li key={r.id} className="py-2 text-xs">
                  <span className="block font-medium text-vip-title">{r.title}</span>
                  <span className="text-vip-muted">{r.category} - {new Date(r.created_at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>}
        <Link to="/vip-portal" className="mt-2 inline-flex items-center gap-1 text-xs text-vip-muted">Open VIP Portal <ChevronRight className="size-3" /></Link>
      </div>
    </section>
  );
}
