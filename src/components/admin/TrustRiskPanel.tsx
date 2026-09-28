import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Loader2, Search, X } from "lucide-react";
import {
  getTrustRiskDirectory,
  setRiskControls,
  setTrustScoreOverride,
  type TrustRiskRow,
} from "@/lib/trust-risk.functions";

function Milestone({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
        on ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
      }`}
    >
      {on ? <Check className="size-3" /> : <X className="size-3" />}
      {label}
    </span>
  );
}

function Toggle({ on, label, onClick, disabled }: { on: boolean; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`touch-manipulation rounded-md border px-2 py-1 text-[11px] font-semibold disabled:opacity-50 ${
        on ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {on ? `Lift: ${label}` : label}
    </button>
  );
}

export function TrustRiskPanel() {
  const qc = useQueryClient();
  const fetchDir = useServerFn(getTrustRiskDirectory);
  const override = useServerFn(setTrustScoreOverride);
  const controls = useServerFn(setRiskControls);
  const [term, setTerm] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const dir = useQuery({
    queryKey: ["admin-trust-risk"],
    queryFn: () => fetchDir() as Promise<TrustRiskRow[]>,
    refetchInterval: 15_000,
  });
  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin-trust-risk"] });
  };
  const ovr = useMutation({
    mutationFn: (v: { userId: string; pct: number | null }) => override({ data: v }),
    onSuccess: () => done("Trust score updated."),
    onError: (e: Error) => toast.error(e.message),
  });
  const ctl = useMutation({
    mutationFn: (v: { userId: string; tradingFrozen?: boolean; marginRestricted?: boolean; verificationRequired?: boolean }) =>
      controls({ data: v }),
    onSuccess: () => done("Risk controls applied."),
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const q = term.trim().toLowerCase();
    const list = dir.data ?? [];
    return q ? list.filter((u) => [u.displayName, u.email ?? "", u.uid ?? "", u.id].some((v) => v.toLowerCase().includes(q))) : list;
  }, [dir.data, term]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">Trader Trust &amp; Risk</h2>
          <p className="text-xs text-muted-foreground">
            Live trust score, margin health, milestones and account risk controls.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search users"
            className="w-44 rounded-md bg-secondary py-1.5 pl-7 pr-2 text-xs outline-none"
          />
        </div>
      </header>
      <div className="max-h-[70vh] divide-y divide-border/60 overflow-auto">
        {dir.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading accounts…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users match that search.</p>
        ) : (
          rows.map((u) => {
            const busy = ovr.isPending || ctl.isPending;
            const draft = drafts[u.id] ?? String(u.trustPct);
            return (
              <div key={u.id} className="space-y-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-40 flex-1">
                    <div className="text-sm font-medium">{u.displayName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{u.uid ?? u.id.slice(0, 8)}</div>
                  </div>
                  <div className="w-32">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Trust score</div>
                    <div className="num text-sm font-semibold">
                      {u.trustPct}%{u.overridePct !== null && <span className="ml-1 text-[10px] text-primary">manual</span>}
                    </div>
                  </div>
                  <div className="w-32">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Account health</div>
                    <div className="num text-sm font-semibold">
                      {u.healthPct.toFixed(1)}%
                      {!u.hasExposure && <span className="ml-1 text-[10px] font-normal text-muted-foreground">no margin</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draft}
                      onChange={(e) => setDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                      className="w-20 rounded-md bg-secondary px-2 py-1.5 text-sm outline-none"
                    />
                    <button
                      disabled={busy}
                      onClick={() => {
                        const n = Number(draft);
                        if (!Number.isFinite(n) || n < 0 || n > 100) return toast.error("Enter 0-100.");
                        ovr.mutate({ userId: u.id, pct: n });
                      }}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                    >
                      {ovr.isPending && <Loader2 className="size-3 animate-spin" />}Set
                    </button>
                    {u.overridePct !== null && (
                      <button
                        disabled={busy}
                        onClick={() => {
                          setDrafts((d) => ({ ...d, [u.id]: String(u.computedTrustPct) }));
                          ovr.mutate({ userId: u.id, pct: null });
                        }}
                        className="rounded-md border border-border px-2 py-1.5 text-xs text-muted-foreground"
                      >
                        Auto
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Milestone on={u.milestones.kyc} label="KYC" />
                    <Milestone on={u.milestones.enhancedKyc} label="Enhanced KYC" />
                    <Milestone on={u.milestones.twoFactor} label="2FA" />
                    <Milestone on={u.milestones.deposit} label="First deposit" />
                    <Milestone on={u.milestones.profitableTrades > 0} label={`Profitable trades · ${u.milestones.profitableTrades}`} />
                    <Milestone on={u.milestones.balanceUnlocked} label=">5k balance" />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Toggle on={u.tradingFrozen} label="Freeze Trading" disabled={busy} onClick={() => ctl.mutate({ userId: u.id, tradingFrozen: !u.tradingFrozen })} />
                    <Toggle on={u.marginRestricted} label="Restrict Margin" disabled={busy} onClick={() => ctl.mutate({ userId: u.id, marginRestricted: !u.marginRestricted })} />
                    <Toggle on={u.verificationRequired} label="Require Verification" disabled={busy} onClick={() => ctl.mutate({ userId: u.id, verificationRequired: !u.verificationRequired })} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
