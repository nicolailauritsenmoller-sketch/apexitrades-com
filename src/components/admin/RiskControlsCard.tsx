import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Gauge, Landmark, OctagonPause, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { ReadOnlyBadge } from "@/components/admin/ReadOnlyBadge";
import { getRiskControls, setRiskControls } from "@/lib/risk-controls.functions";

type Patch = { tradingPaused?: boolean; maxLeverage?: number | null; largeWithdrawalReview?: boolean };

/** Emergency circuit breakers; every change requires an audited confirmation. */
export function RiskControlsCard({ readOnly }: { readOnly: boolean }) {
  const qc = useQueryClient();
  const read = useServerFn(getRiskControls);
  const write = useServerFn(setRiskControls);
  const rc = useQuery({ queryKey: ["risk-controls"], queryFn: () => read() });
  const [pending, setPending] = useState<{ patch: Patch; title: string; description: string; destructive: boolean } | null>(null);
  const [lev, setLev] = useState("");
  const save = useMutation({
    mutationFn: (v: { patch: Patch; reason: string }) => write({ data: v }),
    onSuccess: () => { toast.success("Risk controls updated and logged."); void qc.invalidateQueries({ queryKey: ["risk-controls"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const s = rc.data;
  const row = "flex flex-wrap items-center gap-3 rounded-xl border border-border/70 bg-background/40 p-3";

  return (
    <section className="rounded-2xl border-2 border-destructive/40 bg-card/60">
      <header className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <ShieldAlert className="size-4 text-ops-red" />
        <h3 className="font-display text-sm font-semibold">Risk controls</h3>
        <span className="text-[11px] text-muted-foreground">Global circuit breakers - every change is audited</span>
        {readOnly && <span className="ml-auto"><ReadOnlyBadge /></span>}
      </header>
      {!s ? <p className="p-4 text-sm text-muted-foreground">Loading controls...</p> : (
        <div className="grid gap-2 p-4 lg:grid-cols-3">
          <div className={row}>
            <OctagonPause className="size-5 text-ops-red" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Pause new trade execution</p>
              <p className="text-[11px] text-muted-foreground">{s.tradingPaused ? "PAUSED - new positions and contracts are blocked" : "Live - trading open"}</p>
            </div>
            <Button size="sm" variant={s.tradingPaused ? "default" : "destructive"} disabled={readOnly}
              onClick={() => setPending({ patch: { tradingPaused: !s.tradingPaused }, title: s.tradingPaused ? "Resume Trading" : "Pause Trading", description: s.tradingPaused ? "New trades will be accepted again immediately." : "All new positions and scalp contracts will be rejected platform-wide until resumed. Open positions are not affected.", destructive: !s.tradingPaused })}>
              {s.tradingPaused ? "Resume" : "Pause"}
            </Button>
          </div>
          <div className={row}>
            <Gauge className="size-5 text-ops-amber" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Cap maximum leverage</p>
              <p className="num text-[11px] text-muted-foreground">Current cap: {s.maxLeverage ? `${s.maxLeverage}x` : "none (up to 100x)"}</p>
            </div>
            <input type="number" min={1} max={100} value={lev} onChange={(e) => setLev(e.target.value)} disabled={readOnly} placeholder="x" aria-label="Leverage cap" className="num h-9 w-16 rounded-md border border-input bg-background px-2 text-sm" />
            <Button size="sm" disabled={readOnly || !(Number(lev) >= 1 && Number(lev) <= 100)}
              onClick={() => setPending({ patch: { maxLeverage: Math.round(Number(lev)) }, title: "Set Leverage Cap", description: `New positions above ${Math.round(Number(lev))}x will be rejected. Existing positions are not changed.`, destructive: false })}>Set</Button>
            {s.maxLeverage && <Button size="sm" variant="outline" disabled={readOnly} onClick={() => setPending({ patch: { maxLeverage: null }, title: "Remove Leverage Cap", description: "Leverage returns to the instrument maximum.", destructive: false })}>Clear</Button>}
          </div>
          <div className={row}>
            <Landmark className="size-5 text-ops-emerald" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Manual approval &gt; ${s.largeWithdrawalThresholdUsd.toLocaleString("en-US")}</p>
              <p className="text-[11px] text-muted-foreground">{s.largeWithdrawalReview ? "On - large withdrawals flagged and excluded from batch approval" : "Off"}</p>
            </div>
            <Button size="sm" variant={s.largeWithdrawalReview ? "outline" : "default"} disabled={readOnly}
              onClick={() => setPending({ patch: { largeWithdrawalReview: !s.largeWithdrawalReview }, title: s.largeWithdrawalReview ? "Disable Large-Withdrawal Review" : "Enable Large-Withdrawal Review", description: "Withdrawals above the threshold must be approved one by one after individual review.", destructive: false })}>
              {s.largeWithdrawalReview ? "Turn off" : "Turn on"}
            </Button>
          </div>
        </div>
      )}
      <AdminActionConfirm open={!!pending} title={pending?.title ?? ""} description={pending?.description ?? ""} destructive={pending?.destructive ?? false} pending={save.isPending}
        onClose={() => setPending(null)} onConfirm={async (reason) => { if (pending) { await save.mutateAsync({ patch: pending.patch, reason }); setLev(""); } }} />
    </section>
  );
}
