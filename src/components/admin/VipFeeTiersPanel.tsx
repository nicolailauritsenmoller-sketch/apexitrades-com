import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Pencil, Play, Plus, Trash2, X } from "lucide-react";
import {
  deleteVipTier,
  getVipTierDesk,
  runVipEvaluation,
  setVipGraceDays,
  setVipLevel,
  upsertVipTier,
} from "@/lib/vip-tiers.functions";

const usd = (n: unknown) => `$${Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const pct = (n: unknown) => `${Number(n ?? 0).toFixed(3)}%`;
const clean = (s: string) => s.replace(/[\u2013\u2014]/g, "-");
const FEE_KEYS = ["spot_maker", "spot_taker", "futures_maker", "futures_taker", "scalp_maker", "scalp_taker"] as const;
const CRIT_KEYS = [
  ["min_spot_volume", "Spot volume (30d, USDT)"],
  ["min_futures_volume", "Futures volume (30d, USDT)"],
  ["min_scalp_volume", "Scalping / options volume (30d, USDT)"],
  ["min_portfolio_usdt", "Total portfolio value (USDT)"],
] as const;

function logText(l: any) {
  const d = l.details ?? {};
  const map: Record<string, string> = {
    "vip.grace_started": `Grace period started - Tier ${d.from} to qualify ${d.qualifies} (${d.grace_days} days)`,
    "vip.auto_downgrade": `Auto downgrade - Tier ${d.from} to Tier ${d.to}`,
    "vip.grace_cleared": `Volume recovered - grace cleared at Tier ${d.level}`,
    "vip.level_set": `Tier set - ${d.from} to ${d.to}`,
    "vip.tier_saved": `Tier ${d.level} (${d.name}) saved`,
    "vip.tier_deleted": `Tier ${d.level} deleted`,
    "vip.grace_setting": `Grace period set to ${d.days} days`,
    "vip.fee_override_set": "Custom fee override set",
    "vip.fee_override_cleared": "Custom fee override cleared",
    "vip.account_manager": `Account manager - ${d.name ?? "removed"}`,
  };
  return clean(map[l.action] ?? l.action);
}

function TierEditor({ tier, onClose }: { tier: any; onClose: () => void }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertVipTier);
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(tier).map(([k, v]) => [k, String(v ?? "")])),
  );
  const m = useMutation({
    mutationFn: () => {
      const n = (k: string) => Number(f[k] || 0);
      return save({
        data: {
          level: n("level"),
          name: f["name"] || `Tier ${n("level")}`,
          ...Object.fromEntries(CRIT_KEYS.map(([k]) => [k, n(k)])),
          ...Object.fromEntries(FEE_KEYS.map((k) => [k, n(k)])),
        } as any,
      });
    },
    onSuccess: () => {
      toast.success("Tier saved.");
      qc.invalidateQueries({ queryKey: ["admin-vip-tiers"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const input = (k: string, label: string, step = "any") => (
    <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">
      {label}
      <input
        type="number"
        step={step}
        value={f[k] ?? ""}
        onChange={(e) => setF((p) => ({ ...p, [k]: e.target.value }))}
        className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
      />
    </label>
  );
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-background p-4">
        <div className="mb-3 flex items-center">
          <p className="font-display text-sm font-bold">Tier configuration</p>
          <button onClick={onClose} className="ml-auto rounded-md border border-border p-1"><X className="size-4" /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {input("level", "Level", "1")}
          <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">
            Name
            <input value={f["name"] ?? ""} onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))} className="mt-1 h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground" />
          </label>
        </div>
        <p className="mb-1 mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Eligibility - any one criterion qualifies (0 = not used)</p>
        <div className="grid grid-cols-2 gap-2">{CRIT_KEYS.map(([k, l]) => <div key={k}>{input(k, l)}</div>)}</div>
        <p className="mb-1 mt-3 text-[10px] uppercase tracking-widest text-muted-foreground">Maker / taker fees (%) - negative maker = rebate</p>
        <div className="grid grid-cols-2 gap-2">
          {FEE_KEYS.map((k) => <div key={k}>{input(k, k.replace("_", " "), "0.001")}</div>)}
        </div>
        <button disabled={m.isPending} onClick={() => m.mutate()} className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
          Save tier
        </button>
      </div>
    </div>
  );
}

/** Fee matrix, eligibility thresholds, grace period, recommendations and VIP logs. */
export function VipFeeTiersPanel({ onOpen }: { onOpen?: (userId: string) => void }) {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getVipTierDesk);
  const run = useServerFn(runVipEvaluation);
  const setGrace = useServerFn(setVipGraceDays);
  const setLevel = useServerFn(setVipLevel);
  const del = useServerFn(deleteVipTier);
  const [editing, setEditing] = useState<any | null>(null);
  const [grace, setGraceInput] = useState("");
  const q = useQuery({ queryKey: ["admin-vip-tiers"], queryFn: () => fetchDesk() });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-vip-tiers"] });
  const onErr = (e: Error) => toast.error(e.message);

  const evalM = useMutation({
    mutationFn: () => run(),
    onSuccess: (r: any) => {
      toast.success(`Evaluated ${r.evaluated} accounts - ${r.upgradeRecommendations} upgrade(s) recommended, ${r.downgrades} downgrade(s), ${r.graceStarted} grace period(s) started.`);
      refresh();
    },
    onError: onErr,
  });
  const graceM = useMutation({ mutationFn: (d: number) => setGrace({ data: { days: d } }), onSuccess: () => { toast.success("Grace period updated."); setGraceInput(""); refresh(); }, onError: onErr });
  const levelM = useMutation({ mutationFn: (v: { userId: string; level: number }) => setLevel({ data: v }), onSuccess: () => { toast.success("Tier updated."); refresh(); }, onError: onErr });
  const delM = useMutation({ mutationFn: (level: number) => del({ data: { level } }), onSuccess: () => { toast.success("Tier deleted."); refresh(); }, onError: onErr });

  if (q.isLoading) return <p className="text-sm text-muted-foreground">Loading fee tiers...</p>;
  if (q.isError || !q.data) return <p className="text-sm text-ops-red">{(q.error as Error)?.message}</p>;
  const { tiers, graceDays, accounts, logs } = q.data as any;
  const recs = accounts.filter((a: any) => a.recommended_level !== null);
  const graced = accounts.filter((a: any) => a.grace_until);
  const nextLevel = Math.max(0, ...tiers.map((t: any) => t.level)) + 1;
  const card = "rounded-xl border border-border/70 bg-card/60 p-3";
  const H = "mb-2 text-[10px] uppercase tracking-widest text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center gap-2`}>
        <p className="text-xs">Automatic evaluation runs daily at 00:00 UTC on 30-day rolling volume. Upgrades need admin approval; downgrades apply after the grace period.</p>
        <button disabled={evalM.isPending} onClick={() => evalM.mutate()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary disabled:opacity-50">
          <Play className="size-3.5" /> {evalM.isPending ? "Evaluating..." : "Run evaluation now"}
        </button>
      </div>

      <div className={card}>
        <div className="mb-2 flex items-center">
          <p className={H}>Fee tier matrix (admin only - customers see "VIP")</p>
          <button onClick={() => setEditing({ level: nextLevel, name: `Tier ${nextLevel}`, min_spot_volume: 0, min_futures_volume: 0, min_scalp_volume: 0, min_portfolio_usdt: 0, spot_maker: 0.1, spot_taker: 0.1, futures_maker: 0.02, futures_taker: 0.05, scalp_maker: 0, scalp_taker: 0 })} className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px]">
            <Plus className="size-3" /> Add tier
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="border-b border-border text-[10px] uppercase text-muted-foreground">
              <tr><th className="py-2 pr-2">Tier</th><th>Spot vol</th><th>Futures vol</th><th>Scalp vol</th><th>Portfolio</th><th>Spot M/T</th><th>Futures M/T</th><th>Scalp M/T</th><th /></tr>
            </thead>
            <tbody>
              {tiers.map((t: any) => (
                <tr key={t.level} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-2 font-semibold">{t.level} - {t.name}</td>
                  <td className="num">{usd(t.min_spot_volume)}</td>
                  <td className="num">{usd(t.min_futures_volume)}</td>
                  <td className="num">{usd(t.min_scalp_volume)}</td>
                  <td className="num">{usd(t.min_portfolio_usdt)}</td>
                  <td className="num">{pct(t.spot_maker)} / {pct(t.spot_taker)}</td>
                  <td className="num">{pct(t.futures_maker)} / {pct(t.futures_taker)}</td>
                  <td className="num">{pct(t.scalp_maker)} / {pct(t.scalp_taker)}</td>
                  <td className="text-right">
                    <button aria-label="Edit tier" onClick={() => setEditing(t)} className="rounded p-1 text-muted-foreground hover:text-foreground"><Pencil className="size-3.5" /></button>
                    {t.level > 0 && <button aria-label="Delete tier" onClick={() => delM.mutate(t.level)} className="rounded p-1 text-ops-red"><Trash2 className="size-3.5" /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">All platform orders fill immediately at market, so the taker rate is what gets charged today; maker rates apply once resting limit orders exist.</p>
      </div>

      <div className={card}>
        <p className={H}>VIP protection grace period</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs">Current: <b>{graceDays} days</b></span>
          {[14, 30].map((d) => (
            <button key={d} onClick={() => graceM.mutate(d)} className="rounded-full border border-border px-2.5 py-1 text-[11px]">{d} days</button>
          ))}
          <input value={grace} onChange={(e) => setGraceInput(e.target.value)} inputMode="numeric" placeholder="Custom" className="h-7 w-20 rounded-md border border-border bg-background px-2 text-xs" />
          <button onClick={() => { const d = Number(grace); if (Number.isInteger(d) && d >= 0) graceM.mutate(d); else toast.error("Enter whole days."); }} className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">Set</button>
        </div>
      </div>

      <div className={card}>
        <p className={H}>Upgrade recommendations ({recs.length})</p>
        {recs.length === 0 ? <p className="text-xs text-muted-foreground">No accounts awaiting upgrade approval.</p> : (
          <ul className="space-y-1.5">
            {recs.map((a: any) => (
              <li key={a.user_id} className="flex flex-wrap items-center gap-2 text-xs">
                <button onClick={() => onOpen?.(a.user_id)} className="font-semibold hover:underline">{a.profile?.display_name ?? "Trader"}</button>
                <span className="font-mono text-muted-foreground">{a.profile?.uid ?? "-"}</span>
                <span className="text-muted-foreground">Tier {a.level} - qualifies for Tier {a.recommended_level} · spot {usd(a.spot_volume_30d)} · futures {usd(a.futures_volume_30d)} · scalp {usd(a.scalp_volume_30d)} · portfolio {usd(a.portfolio_usdt)}</span>
                <button onClick={() => levelM.mutate({ userId: a.user_id, level: a.recommended_level })} className="ml-auto rounded-md border border-ops-emerald/40 px-2 py-1 font-semibold text-ops-emerald">Approve Tier {a.recommended_level}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <p className={H}>In grace period ({graced.length})</p>
        {graced.length === 0 ? <p className="text-xs text-muted-foreground">No accounts in grace.</p> : (
          <ul className="space-y-1 text-xs">
            {graced.map((a: any) => (
              <li key={a.user_id}>{a.profile?.display_name ?? "Trader"} - Tier {a.level} protected until {new Date(a.grace_until).toLocaleString()}</li>
            ))}
          </ul>
        )}
      </div>

      <div className={card}>
        <p className={H}>VIP log</p>
        {logs.length === 0 ? <p className="text-xs text-muted-foreground">No VIP events yet.</p> : (
          <ol className="max-h-72 space-y-1.5 overflow-y-auto">
            {logs.map((l: any) => (
              <li key={l.id} className="border-l-2 border-border pl-2 text-[11px]">
                <p className="font-medium">{logText(l)}{l.profile ? ` - ${l.profile.display_name ?? ""} (${l.profile.uid ?? "-"})` : ""}</p>
                <p className="font-mono text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()} - {l.actor_name ?? "Admin"}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      {editing && <TierEditor tier={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
