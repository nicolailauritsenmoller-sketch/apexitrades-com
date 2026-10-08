import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, BellRing, ShieldAlert, Zap } from "lucide-react";
import { DANGER_BTN } from "@/lib/admin-accents";
import { forceLiquidatePosition, getRiskMonitor, issueMarginCall } from "@/lib/admin-ops.functions";
import { AssetIcon } from "@/lib/asset-icons";
import { UidTag } from "@/components/VerifiedBadge";
import { downloadCsv } from "@/lib/csv";

const n = (v: unknown, d = 2) =>
  Number(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: d });

function riskTone(pct: number) {
  if (pct >= 80) return { label: "Critical", cls: "bg-bear/20 text-ops-red" };
  if (pct >= 50) return { label: "High", cls: "bg-amber-500/20 text-ops-amber" };
  if (pct >= 25) return { label: "Elevated", cls: "bg-primary/15 text-primary" };
  return { label: "Healthy", cls: "bg-ops-emerald-bg text-ops-emerald" };
}

/** Live leverage/margin risk board with an emergency liquidation control. */
export function RiskMonitor() {
  const qc = useQueryClient();
  const fetchRisk = useServerFn(getRiskMonitor);
  const liquidate = useServerFn(forceLiquidatePosition);
  const [minRisk, setMinRisk] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [mode, setMode] = useState<"liquidate" | "call">("liquidate");
  const [reason, setReason] = useState("");
  const call = useServerFn(issueMarginCall);
  const marginCall = useMutation({
    mutationFn: (input: { id: string; reason: string }) => call({ data: input }),
    onSuccess: () => {
      toast.success("Margin call sent to the account holder");
      setConfirmId(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = useQuery({
    queryKey: ["admin-risk-monitor"],
    queryFn: () => fetchRisk(),
    refetchInterval: 15_000,
  });

  const kill = useMutation({
    mutationFn: (input: { id: string; reason: string }) => liquidate({ data: input }),
    onSuccess: (r: any) => {
      toast.success(`Liquidated at ${n(r.exitPrice, 6)} · P&L ${n(r.pnl)} ${r.currency}`);
      setConfirmId(null);
      setReason("");
      void qc.invalidateQueries({ queryKey: ["admin-risk-monitor"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const positions = (q.data?.positions ?? []) as any[];
  const accounts = (q.data?.accounts ?? []) as any[];
  const rows = useMemo(
    () => positions.filter((p) => p.riskPct >= minRisk),
    [positions, minRisk],
  );

  const atRisk = positions.filter((p) => p.riskPct >= 50).length;
  const totalMargin = accounts.reduce((a, x) => a + x.marginUsed, 0);
  const totalEquity = accounts.reduce((a, x) => a + x.totalEquity, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Open positions", value: positions.length },
          { label: "At-risk (≥50%)", value: atRisk },
          { label: "Margin used", value: `$${n(totalMargin)}` },
          {
            label: "Platform utilisation",
            value: `${n(totalEquity > 0 ? (totalMargin / totalEquity) * 100 : 0, 1)}%`,
          },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/70 bg-card/60 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {s.label}
            </p>
            <p className="num mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border/70 bg-card/50">
        <header className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <ShieldAlert className="size-4 text-ops-red" />
          <h3 className="font-display text-sm font-semibold">Position risk monitor</h3>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-[11px] text-muted-foreground">Min risk {minRisk}%</label>
            <input
              type="range"
              min={0}
              max={90}
              step={10}
              value={minRisk}
              onChange={(e) => setMinRisk(Number(e.target.value))}
              className="w-28 accent-[hsl(var(--primary))]"
            />
            <button
              onClick={() =>
                downloadCsv(
                  `risk-positions-${new Date().toISOString().slice(0, 10)}`,
                  rows as any,
                )
              }
              className="touch-manipulation rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold"
            >
              Export CSV
            </button>
          </div>
        </header>

        {q.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Loading risk book…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            No open leveraged positions match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Risk</th>
                  <th className="px-3 py-2 text-left font-medium">Instrument</th>
                  <th className="px-3 py-2 text-left font-medium">User</th>
                  <th className="px-3 py-2 text-right font-medium">Margin</th>
                  <th className="px-3 py-2 text-right font-medium">Entry / Mark</th>
                  <th className="px-3 py-2 text-right font-medium">P&L</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const tone = riskTone(p.riskPct);
                  return (
                    <tr key={p.id} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${tone.cls}`}
                        >
                          {tone.label} {n(p.riskPct, 0)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <AssetIcon symbol={p.symbol} size={20} />
                          <div>
                            <p className="font-medium">{p.displaySymbol}</p>
                            <p className="num text-[10px] uppercase text-muted-foreground">
                              {p.side} · {n(p.leverage, 0)}x · {p.assetClass}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="truncate text-xs">{p.userName}</p>
                        <UidTag uid={p.uid} />
                      </td>
                      <td className="num px-3 py-2.5 text-right">
                        {n(p.margin)} {p.currency}
                      </td>
                      <td className="num px-3 py-2.5 text-right text-xs">
                        {n(p.entryPrice, 6)} → {n(p.markPrice, 6)}
                      </td>
                      <td
                        className={`num px-3 py-2.5 text-right font-semibold ${
                          p.pnl >= 0 ? "text-ops-emerald" : "text-ops-red"
                        }`}
                      >
                        {p.pnl >= 0 ? "+" : ""}
                        {n(p.pnl)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <button
                          onClick={() => {
                            setMode("call");
                            setConfirmId(p.id);
                          }}
                          className="mr-1.5 inline-flex touch-manipulation items-center gap-1 rounded-lg border border-amber-500/40 px-2 py-1 text-[11px] font-semibold text-ops-amber"
                        >
                          <BellRing className="size-3" /> Margin call
                        </button>
                        <button
                          onClick={() => {
                            setMode("liquidate");
                            setConfirmId(p.id);
                          }}
                          className={`inline-flex items-center gap-1 ${DANGER_BTN}`}
                        >
                          <Zap className="size-3" /> Liquidate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border/70 bg-card/50">
        <header className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <AlertTriangle className="size-4 text-ops-amber" />
          <h3 className="font-display text-sm font-semibold">Account margin utilisation</h3>
        </header>
        {accounts.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No margin exposure.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {accounts.map((a) => (
              <li key={a.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {a.userName} {a.frozen && <span className="text-[10px] text-ops-red">FROZEN</span>}
                  </p>
                  <p className="num text-[11px] text-muted-foreground">
                    Margin ${n(a.marginUsed)} / equity ${n(a.totalEquity)} · open P&L{" "}
                    <span className={a.openPnl >= 0 ? "text-ops-emerald" : "text-ops-red"}>
                      {n(a.openPnl)}
                    </span>
                  </p>
                </div>
                <div className="w-40">
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full ${
                        a.utilizationPct >= 80
                          ? "bg-bear"
                          : a.utilizationPct >= 50
                            ? "bg-amber-400"
                            : "bg-bull"
                      }`}
                      style={{ width: `${Math.min(100, a.utilizationPct)}%` }}
                    />
                  </div>
                  <p className="num mt-1 text-right text-[10px] text-muted-foreground">
                    {n(a.utilizationPct, 1)}% used
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdminActionConfirm open={!!confirmId} title={mode === "call" ? "Send margin call" : "Force Liquidation"} description={mode === "call" ? "Notify the customer to add funds or reduce exposure." : "Immediately settle this position at the live mark and return remaining margin to the wallet."} pending={kill.isPending || marginCall.isPending} destructive={mode === "liquidate"} onClose={() => setConfirmId(null)} onConfirm={async (reason) => { if (!confirmId) return; if (mode === "call") await marginCall.mutateAsync({ id: confirmId, reason }); else await kill.mutateAsync({ id: confirmId, reason }); }} />

    </div>
  );
}
