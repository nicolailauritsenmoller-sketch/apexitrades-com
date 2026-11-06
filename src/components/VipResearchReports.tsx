import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Lock, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Report = { id: string; title: string; summary: string; body: string; category: string; created_at: string };

/** VIP-only research library. Database policy returns rows only to active VIP members. */
export function VipResearchReports({ isVip }: { isVip: boolean }) {
  const [open, setOpen] = useState<Report | null>(null);
  const q = useQuery({
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
      return (data ?? []) as Report[];
    },
  });

  return (
    <section className="mt-8" aria-labelledby="research-title">
      <h2 id="research-title" className="mb-4 text-xl">Market Research Reports</h2>
      {!isVip ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <Lock className="size-5 shrink-0 text-ops-amber" />
          Research reports are available to VIP members. Membership is granted after collateral review.
        </div>
      ) : q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading reports...</p>
      ) : q.isError ? (
        <p role="alert" className="text-sm text-muted-foreground">Reports are unavailable right now.</p>
      ) : !q.data?.length ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">No reports have been published yet.</p>
      ) : (
        <div className="space-y-3">
          {q.data.map((r) => (
            <Button key={r.id} variant="outline" className="h-auto min-h-20 w-full justify-start gap-4 rounded-lg bg-card p-4 text-left" onClick={() => setOpen(r)}>
              <FileText className="size-6 shrink-0 text-ops-amber" />
              <span className="flex-1 whitespace-normal">
                <span className="block text-xs font-normal text-muted-foreground">{r.category} - {new Date(r.created_at).toLocaleDateString()}</span>
                <span className="mt-1 block text-sm font-medium">{r.title}</span>
                {r.summary && <span className="mt-1 block text-xs font-normal text-muted-foreground">{r.summary}</span>}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          ))}
        </div>
      )}
      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{open?.title}</DialogTitle>
            <DialogDescription>{open?.category} - {open && new Date(open.created_at).toLocaleDateString()}</DialogDescription>
          </DialogHeader>
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{open?.body}</div>
          <p className="text-xs text-muted-foreground">For information only. Not investment advice.</p>
        </DialogContent>
      </Dialog>
    </section>
  );
}
