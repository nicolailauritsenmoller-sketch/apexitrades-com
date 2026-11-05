import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AdminActionConfirm } from "./AdminActionConfirm";
import { AdminTableToolbar } from "./AdminTableToolbar";
import { useScalpingRules } from "@/hooks/useScalpingRules";
import { saveScalpingRule, removeScalpingRule } from "@/lib/scalping-rules.functions";
import { scalpingRuleInput, SCALPING_MAJORS, type ScalpingRule } from "@/lib/scalping-rules";
import { INSTRUMENTS, displaySymbol } from "@/lib/instruments";
import { downloadCsv } from "@/lib/csv";

type Draft = { id?: string; label: string; seconds: string; minimum: string; maximum: string; commission: string; payoutCap: string; pairMode: string; pairs: string[]; roi: string; active: boolean };
const emptyDraft: Draft = { label: "60s", seconds: "60", minimum: "100", maximum: "", commission: "0", payoutCap: "", pairMode: "all", pairs: [], roi: "10", active: true };
const presets = [[60, "60s"], [120, "120s"], [180, "180s"], [86400, "24hr"], [604800, "7 days"]] as const;
const inputClass = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export function ScalpingManagement() {
  const rules = useScalpingRules(true);
  const client = useQueryClient();
  const save = useServerFn(saveScalpingRule);
  const remove = useServerFn(removeScalpingRule);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [term, setTerm] = useState("");
  const [pairSearch, setPairSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [action, setAction] = useState<{ rule: ScalpingRule; remove: boolean } | null>(null);
  const refresh = () => { void client.invalidateQueries({ queryKey: ["scalping-rules"] }); };
  const saveMutation = useMutation({ mutationFn: (data: Parameters<typeof scalpingRuleInput.parse>[0]) => save({ data: scalpingRuleInput.parse(data) }),
    onSuccess: () => { refresh(); setDraft(null); toast.success("Scalping tier saved."); }, onError: (error: Error) => toast.error(error.message) });
  const actionMutation = useMutation({ mutationFn: async () => {
    if (!action) throw new Error("No tier selected.");
    if (action.remove) return remove({ data: { id: action.rule.id } });
    return save({ data: { ...action.rule, active: !action.rule.active } });
  }, onSuccess: () => { refresh(); toast.success("Scalping tier updated."); }, onError: (error: Error) => toast.error(error.message) });
  const rows = (rules.data ?? []).filter(r => r.label.toLowerCase().includes(term.toLowerCase()) && (status === "all" || r.active === (status === "active")));
  const patch = (values: Partial<Draft>) => setDraft(current => current ? { ...current, ...values } : current);
  const parsed = draft ? scalpingRuleInput.safeParse({ id: draft.id, label: draft.label, duration_seconds: Number(draft.seconds), min_trade_amount: Number(draft.minimum), max_trade_amount: draft.maximum.trim() ? Number(draft.maximum) : null, commission_pct: Number(draft.commission), daily_payout_cap: draft.payoutCap.trim() ? Number(draft.payoutCap) : null, allowed_pairs: draft.pairMode === "all" ? [] : draft.pairMode === "majors" ? SCALPING_MAJORS : draft.pairs, roi_pct: Number(draft.roi), active: draft.active }) : null;
  const pairsValid = draft?.pairMode !== "custom" || draft.pairs.length > 0;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <div className="flex gap-6 text-sm"><span>Duration tiers <strong className="num ml-2">{rules.data?.length ?? 0}</strong></span><span className="text-muted-foreground">Active <strong className="num ml-2 text-foreground">{rules.data?.filter(r => r.active).length ?? 0}</strong></span></div>
      <Button onClick={() => { setPairSearch(""); setDraft({ ...emptyDraft }); }}><Plus />Add tier</Button>
    </div>
    <div className="flex flex-wrap items-center gap-3">
      <select aria-label="Tier status" value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All tiers</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      <AdminTableToolbar term={term} onSearch={setTerm} onRefresh={refresh} refreshing={rules.isFetching} onExport={() => downloadCsv("scalping-tiers", rows)} />
    </div>
    {rules.isPending ? <p className="text-muted-foreground">Loading tiers...</p> : rules.isError ? <p role="alert" className="text-destructive">{rules.error.message}</p> : <div className="overflow-x-auto border-y border-border">
      <table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr>{["Duration", "Minimum (USDT)", "Maximum (USDT)", "Pairs", "Commission", "Daily payout cap", "Estimated ROI", "Status", "Updated", "Actions"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{rows.map(rule => <tr key={rule.id} className="border-t border-border">
          <td className="px-4 py-4 font-medium">{rule.label}<span className="mt-1 block text-xs text-muted-foreground">{rule.duration_seconds.toLocaleString()} seconds</span></td>
          <td className="num px-4 py-4">{Number(rule.min_trade_amount).toLocaleString("en-US")}</td>
          <td className="num px-4 py-4">{rule.max_trade_amount === null ? "Unlimited" : Number(rule.max_trade_amount).toLocaleString("en-US")}</td>
          <td className="px-4 py-4" title={rule.allowed_pairs.join(", ")}>{rule.allowed_pairs.length === 0 ? "All pairs" : rule.allowed_pairs.length === SCALPING_MAJORS.length && SCALPING_MAJORS.every(p => rule.allowed_pairs.includes(p)) ? "Majors only" : `${rule.allowed_pairs.length} selected`}</td>
          <td className="num px-4 py-4">{rule.commission_pct}%</td>
          <td className="num px-4 py-4">{rule.daily_payout_cap === null ? "Unlimited" : `${Number(rule.daily_payout_cap).toLocaleString("en-US")} USDT`}</td>
          <td className="num px-4 py-4">{Number(rule.roi_pct)}%</td>
          <td className="px-4 py-4"><div className="flex items-center gap-2"><Switch aria-label={`Active ${rule.label}`} checked={rule.active} onCheckedChange={() => setAction({ rule, remove: false })} /><span className="text-xs text-muted-foreground">{rule.active ? "Active" : "Inactive"}</span></div></td>
          <td className="px-4 py-4 text-xs text-muted-foreground">{new Date(rule.updated_at).toLocaleString()}</td>
          <td className="px-4 py-4"><div className="flex gap-1"><Button variant="outline" size="icon" title={`Edit ${rule.label}`} aria-label={`Edit ${rule.label}`} onClick={() => { setPairSearch(""); setDraft({ id: rule.id, label: rule.label, seconds: String(rule.duration_seconds), minimum: String(rule.min_trade_amount), maximum: rule.max_trade_amount === null ? "" : String(rule.max_trade_amount), commission: String(rule.commission_pct), payoutCap: rule.daily_payout_cap === null ? "" : String(rule.daily_payout_cap), pairMode: rule.allowed_pairs.length === 0 ? "all" : rule.allowed_pairs.length === SCALPING_MAJORS.length && SCALPING_MAJORS.every(p => rule.allowed_pairs.includes(p)) ? "majors" : "custom", pairs: rule.allowed_pairs, roi: String(rule.roi_pct), active: rule.active }); }}><Pencil /></Button><Button variant="ghost" size="icon" className="text-destructive" title={`Remove ${rule.label}`} aria-label={`Remove ${rule.label}`} onClick={() => setAction({ rule, remove: true })}><Trash2 /></Button></div></td>
        </tr>)}{rows.length === 0 && <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No duration tiers.</td></tr>}</tbody>
      </table>
    </div>}
    <Dialog open={draft !== null} onOpenChange={open => { if (!open && !saveMutation.isPending) setDraft(null); }}><DialogContent className="z-[130] max-h-[90dvh] overflow-y-auto">
      <DialogTitle>{draft?.id ? "Edit duration tier" : "Add duration tier"}</DialogTitle><DialogDescription>Scalping and timed trade terms · USDT</DialogDescription>
      {draft && <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (parsed?.success && pairsValid) saveMutation.mutate(parsed.data); }}>
        <label className="block space-y-1 text-sm">Duration preset<select aria-label="Duration preset" className={inputClass} value={presets.some(([s]) => String(s) === draft.seconds) ? draft.seconds : "custom"} onChange={e => { const preset = presets.find(([s]) => String(s) === e.target.value); if (preset) patch({ seconds: String(preset[0]), label: preset[1] }); else patch({ seconds: "", label: "Custom" }); }}><option value="custom">Custom</option>{presets.map(([s, label]) => <option key={s} value={s}>{label}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3"><label className="space-y-1 text-sm">Label<input aria-label="Tier label" required maxLength={40} className={inputClass} value={draft.label} onChange={e => patch({ label: e.target.value })} /></label><label className="space-y-1 text-sm">Duration (seconds)<input aria-label="Duration seconds" type="number" min={1} max={31536000} step={1} required className={inputClass} value={draft.seconds} onChange={e => patch({ seconds: e.target.value })} /></label></div>
        <label className="block space-y-1 text-sm">Minimum trade amount (USDT)<input aria-label="Minimum trade amount" type="number" min="0.00000001" max={100000000} step="any" required className={inputClass} value={draft.minimum} onChange={e => patch({ minimum: e.target.value })} /></label>
        <label className="block space-y-1 text-sm">Maximum trade amount (USDT)<input aria-label="Maximum trade amount" type="number" min={Number(draft.minimum) || 0.00000001} max={100000000} step="any" placeholder="Unlimited" className={inputClass} value={draft.maximum} onChange={e => patch({ maximum: e.target.value })} /></label>
        <label className="block space-y-1 text-sm">Asset / pair restrictions<select aria-label="Pair restrictions" className={inputClass} value={draft.pairMode} onChange={e => patch({ pairMode: e.target.value })}><option value="all">All pairs</option><option value="majors">Majors only - BTC, ETH, SOL, XRP, BNB / USDT</option><option value="custom">Selected pairs</option></select></label>
        {draft.pairMode === "custom" && <div className="space-y-2"><input aria-label="Search eligible pairs" placeholder="Search pairs" className={inputClass} value={pairSearch} onChange={e => setPairSearch(e.target.value)} /><div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto border-y border-border py-2">{INSTRUMENTS.filter(p => `${p.symbol} ${p.name}`.toLowerCase().includes(pairSearch.toLowerCase())).map(p => <label key={p.symbol} className="flex min-h-9 items-center gap-2 text-xs"><Checkbox aria-label={`Allow ${p.symbol}`} checked={draft.pairs.includes(p.symbol)} onCheckedChange={checked => patch({ pairs: checked ? [...new Set([...draft.pairs, p.symbol])] : draft.pairs.filter(s => s !== p.symbol) })} /><span className="break-all">{displaySymbol(p.symbol)}</span></label>)}</div><p className="text-xs text-muted-foreground">{draft.pairs.length} pairs selected</p>{!pairsValid && <p role="alert" className="text-xs text-destructive">Select at least one pair.</p>}</div>}
        <label className="block space-y-1 text-sm">Platform commission (%)<input aria-label="Platform commission" type="number" min={0} max={100} step="any" required className={inputClass} value={draft.commission} onChange={e => patch({ commission: e.target.value })} /></label>
        <label className="block space-y-1 text-sm">Daily aggregate payout cap (USDT)<input aria-label="Daily payout cap" type="number" min="0.00000001" max={1000000000000} step="any" placeholder="Unlimited" className={inputClass} value={draft.payoutCap} onChange={e => patch({ payoutCap: e.target.value })} /><span className="block text-xs text-muted-foreground">All users · UTC expiry day · stake plus profit</span></label>
        <label className="block space-y-1 text-sm">ROI / Estimated return (%)<input aria-label="Estimated return percentage" type="number" min={0} max={10000} step="any" required className={inputClass} value={draft.roi} onChange={e => patch({ roi: e.target.value })} /></label>
        <div className="flex items-center justify-between text-sm"><span>Active</span><Switch aria-label="Tier active" checked={draft.active} onCheckedChange={active => patch({ active })} /></div>
        {parsed && !parsed.success && <p role="alert" className="text-xs text-destructive">{parsed.error.issues[0]?.message}</p>}
        <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" disabled={saveMutation.isPending} onClick={() => setDraft(null)}>Cancel</Button><Button type="submit" disabled={!parsed?.success || !pairsValid || saveMutation.isPending}>{saveMutation.isPending && <Loader2 className="animate-spin" />}Save tier</Button></div>
      </form>}
    </DialogContent></Dialog>
    <AdminActionConfirm open={action !== null} title={action?.remove ? "Remove tier" : action?.rule.active ? "Deactivate tier" : "Activate tier"} description={`Change availability for ${action?.rule.label ?? "this tier"}. Existing contracts retain their original terms.`} pending={actionMutation.isPending} onClose={() => setAction(null)} onConfirm={() => actionMutation.mutateAsync()} destructive={!!action?.remove || !!action?.rule.active} noReason />
  </section>;
}