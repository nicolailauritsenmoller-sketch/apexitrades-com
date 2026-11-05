import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { complianceAlertSchema } from "@/lib/compliance-alerts";
import { getComplianceSubmission } from "@/lib/compliance-alerts.functions";
import { KycReviewDrawer } from "@/components/admin/KycReviewDrawer";

export function ComplianceAlerts({ reviewId, onReview, onClose }: {
  reviewId?: string; onReview: (id: string) => void; onClose: () => void;
}) {
  const qc = useQueryClient();
  const openReview = useRef(onReview);
  openReview.current = onReview;
  const fetchSubmission = useServerFn(getComplianceSubmission);
  const review = useQuery({
    queryKey: ["compliance-review", reviewId],
    queryFn: () => {
      if (!reviewId) throw new Error("Submission required");
      return fetchSubmission({ data: { id: reviewId } });
    },
    enabled: Boolean(reviewId), retry: false,
  });

  useEffect(() => {
    let active = true;
    let catchingUp = false;
    let cursor = new Date().toISOString();
    const seen = new Set<string>();
    const receive = (value: unknown) => {
      const parsed = complianceAlertSchema.safeParse(value);
      if (!active || !parsed.success || seen.has(parsed.data.id)) return;
      const alert = parsed.data;
      seen.add(alert.id);
      void qc.invalidateQueries({ queryKey: ["admin-overview"] });
      void qc.invalidateQueries({ queryKey: ["admin-analytics"] });
      toast.warning(`New Lv.2 Biometric Verification Pending Review - ${alert.user_name}`, {
        id: `compliance-${alert.id}`, duration: Infinity,
        description: "High priority - compliance review required",
        action: { label: "Review Lv.2", onClick: () => openReview.current(alert.submission_id) },
        closeButton: true,
      });
    };
    const catchUp = async () => {
      if (!active || catchingUp) return;
      catchingUp = true;
      try {
        const { data, error } = await supabase.from("compliance_alerts")
          .select("id,submission_id,user_name,kind,priority,created_at")
          .gte("created_at", cursor).order("created_at", { ascending: true });
        if (!active || error) return;
        for (const row of data ?? []) receive(row);
        const last = data?.at(-1);
        if (last) cursor = last.created_at;
      } finally { catchingUp = false; }
    };
    const channel = supabase.channel(`compliance-alerts-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "compliance_alerts" },
        (payload) => receive(payload.new))
      .subscribe((status) => { if (status === "SUBSCRIBED") void catchUp(); });
    // Reconcile outages and background tabs without replaying historical alerts.
    const interval = window.setInterval(() => { void catchUp(); }, 30_000);
    const focus = () => { void catchUp(); };
    window.addEventListener("focus", focus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", focus);
      void supabase.removeChannel(channel);
      for (const id of seen) toast.dismiss(`compliance-${id}`);
    };
  }, [qc]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
    void qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    void qc.invalidateQueries({ queryKey: ["compliance-review", reviewId] });
  };
  if (!reviewId) return null;
  if (review.data) return <KycReviewDrawer key={reviewId} row={review.data} initialTier="L2" onClose={onClose} onDone={refresh} />;
  return <div role="dialog" aria-modal="true" aria-label="Compliance review" className="fixed inset-0 z-[115] flex justify-end bg-background/90">
    <aside className="flex w-full max-w-4xl flex-col gap-4 border-l border-border bg-background p-6">
      <ShieldAlert className="size-6 text-ops-amber" />
      <p role="status" className="text-sm">{review.isError ? "Unable to open this compliance submission." : "Opening Lv.2 compliance review..."}</p>
      <div className="flex gap-2">
        {review.isError && <Button variant="outline" onClick={() => { void review.refetch(); }}>Retry</Button>}
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </aside>
  </div>;
}