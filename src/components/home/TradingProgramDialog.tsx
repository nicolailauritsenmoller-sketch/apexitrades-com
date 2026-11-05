import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Layers3, ShieldCheck, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { applyAsCopyLeader, getTradingPrograms, saveProgramRequest } from "@/lib/trading-programs.functions";
import { leaderApplicationSchema, programRequestSchema } from "@/lib/trading-programs";

export type TradingProgram = "copy_trading" | "tournament" | "liquidity";
const titles = { copy_trading: "Futures Copy Trading", tournament: "Global Trading Tournament", liquidity: "Institutional Liquidity Program" };

export function TradingProgramDialog({ program, onClose }: { program: TradingProgram | null; onClose: () => void }) {
  const fetchPrograms = useServerFn(getTradingPrograms);
  const saveRequest = useServerFn(saveProgramRequest);
  const applyLeader = useServerFn(applyAsCopyLeader);
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["trading-programs"], queryFn: () => fetchPrograms(), enabled: program !== null, refetchInterval: 15_000 });
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [budget, setBudget] = useState("");
  const [leverage, setLeverage] = useState<1 | 2 | 5 | 10>(1);
  const [publicName, setPublicName] = useState("");
  const [bio, setBio] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const existing = query.data?.requests.find(request => request.program === program);
  const leaders = [...(query.data?.leaders ?? [])].sort((a, b) => Number(b.roi_pct ?? -Infinity) - Number(a.roi_pct ?? -Infinity));
  async function submit(asLeader = false) {
    if (!program) return;
    setFeedback(""); setBusy(true);
    try {
      if (asLeader) await applyLeader({ data: leaderApplicationSchema.parse({ publicName, bio, consent }) });
      else await saveRequest({ data: programRequestSchema.parse({ program, leaderId, budget: budget === "" ? 0 : Number(budget), leverage }) });
      await client.invalidateQueries({ queryKey: ["trading-programs"] });
      setFeedback(asLeader ? "Application submitted for review." : "Request saved. No funds reserved or debited.");
    } catch (error) { setFeedback(error instanceof Error ? error.message : "Unable to save. Please try again."); }
    finally { setBusy(false); }
  }
  return <Dialog open={program !== null} onOpenChange={open => { if (!open) { onClose(); setFeedback(""); } }}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-1.5rem)] gap-0 overflow-y-auto rounded-lg border-border bg-background p-0 sm:max-w-3xl">
      <DialogHeader className="border-b border-border bg-surface px-5 py-6 text-left sm:px-7">
        <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase text-muted-foreground"><Layers3 className="size-4 text-bull" />Velocity Trade / Trader programs</div>
        <DialogTitle className="pr-6 text-xl font-semibold tracking-normal sm:text-2xl">{program ? titles[program] : "Trading programs"}</DialogTitle>
        <DialogDescription className="max-w-xl text-xs leading-5">{program === "copy_trading" ? "Leader enrollment and copy preferences. Real-money execution is not enabled." : "Proposed program - registration of interest only."}</DialogDescription>
      </DialogHeader>
      <div className="space-y-6 px-5 py-6 sm:px-7">
      {query.isPending ? <p className="text-sm text-muted-foreground">Loading...</p> : query.isError ? <div role="alert" className="text-sm text-bear">Unable to load programs.<Button variant="ghost" onClick={() => query.refetch()}>Retry</Button></div> : <>
        {program === "copy_trading" ? <>
          <form onSubmit={event => { event.preventDefault(); void submit(true); }} className="space-y-4 border-b border-border pb-6">
            <div className="flex items-center gap-3"><Trophy className="size-4 text-muted-foreground" /><h2 className="text-sm font-semibold tracking-normal">Public leaderboard enrollment</h2></div>
            {query.data?.application ? <p role="status" className="flex items-center gap-2 border-l-2 border-bull bg-bull/5 px-3 py-3 text-xs"><ShieldCheck className="size-4 text-bull" />Leader application<span className="ml-auto font-mono uppercase text-bull">{query.data.application.status}</span></p> : <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block space-y-2 text-xs font-medium text-muted-foreground">Public trader name<Input className="h-11 rounded-md bg-surface text-foreground" placeholder="Trader handle" value={publicName} onChange={event => setPublicName(event.target.value)} minLength={2} maxLength={60} required /></label>
                <label className="block space-y-2 text-xs font-medium text-muted-foreground">Strategy summary<Input className="h-11 rounded-md bg-surface text-foreground" placeholder="Markets, approach and risk mandate" value={bio} onChange={event => setBio(event.target.value)} maxLength={400} /></label>
              </div>
              <div className="flex items-center justify-between gap-4 border-y border-border py-4">
                <label htmlFor="leader-public-consent" className="cursor-pointer text-xs leading-5"><span className="mb-1 block font-semibold text-foreground">Public performance disclosure</span><span className="text-muted-foreground">I consent to publishing my trader name, strategy and closed-trade results on the public leaderboard.</span></label>
                <Switch id="leader-public-consent" checked={consent} onCheckedChange={setConsent} required className="data-[state=checked]:bg-bull" />
              </div>
              <Button className="min-h-11 w-full rounded-md sm:w-auto" disabled={busy || !consent} type="submit">Submit leader application<ArrowRight className="size-4" /></Button>
            </>}
          </form>
          <section className="space-y-4" aria-label="Lead trader directory">
            <div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-3 text-sm font-semibold tracking-normal"><Users className="size-4 text-muted-foreground" />Lead trader directory</h2><span className="rounded border border-border bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground">30D</span></div>
            <p className="text-xs leading-5 text-muted-foreground">30-day closed-position return on committed margin, net of recorded fees. Rankings exclude scalp contracts.</p>
            {leaders.length === 0 ? <div className="border-y border-border bg-surface/50 px-4 py-8 text-center"><Users className="mx-auto mb-3 size-5 text-muted-foreground" /><p className="text-sm font-medium">No approved lead traders yet</p><p className="mt-1 text-xs text-muted-foreground">No performance figures are published.</p></div> : <div className="divide-y divide-border border-y border-border">{leaders.map(leader => <Button key={leader.leader_id} variant="ghost" aria-pressed={leaderId === leader.leader_id} onClick={() => setLeaderId(leader.leader_id)} className={`h-auto w-full flex-col items-stretch gap-3 whitespace-normal rounded-none px-3 py-4 text-left hover:bg-surface-raised hover:text-foreground ${leaderId === leader.leader_id ? "bg-bull/5 ring-1 ring-inset ring-bull/30" : "bg-surface/40"}`}>
              <span className="flex items-center justify-between gap-3"><span className="min-w-0 break-words font-semibold">{leader.public_name}</span><span className="flex shrink-0 items-center gap-1 rounded border border-bull/25 bg-bull/10 px-2 py-1 text-[10px] font-medium text-bull">{leaderId === leader.leader_id ? <Check className="size-3" /> : <ShieldCheck className="size-3" />}{leaderId === leader.leader_id ? "Selected" : "Enrolled"}</span></span>
              {leader.bio && <span className="text-xs font-normal leading-5 text-muted-foreground">{leader.bio}</span>}
              <span className="grid grid-cols-3 divide-x divide-border border-t border-border pt-3 text-xs"><span className="pr-2"><span className="block text-[10px] font-normal text-muted-foreground">Net return</span><span className={`mt-1 block font-mono ${Number(leader.roi_pct) < 0 ? "text-bear" : leader.roi_pct == null ? "text-muted-foreground" : "text-bull"}`}>{leader.roi_pct == null ? "Unreported" : `${Number(leader.roi_pct).toFixed(2)}%`}</span></span><span className="px-3"><span className="block text-[10px] font-normal text-muted-foreground">Win rate</span><span className="mt-1 block font-mono">{leader.win_rate_pct == null ? "Unreported" : `${Number(leader.win_rate_pct).toFixed(1)}%`}</span></span><span className="pl-3"><span className="block text-[10px] font-normal text-muted-foreground">Closed trades</span><span className="mt-1 block font-mono">{leader.closed_trades}</span></span></span>
            </Button>)}</div>}
            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground"><span className="rounded border border-border px-2 py-1">Sharpe ratio: unreported</span><span className="rounded border border-border px-2 py-1">Managed volume: unreported</span></div>
          </section>
          <section className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2" aria-label="Allocation preferences">
            <label className="block space-y-2 text-xs font-medium text-muted-foreground">Requested allocation (USDT)<Input className="h-11 rounded-md bg-surface font-mono text-base text-foreground" aria-label="Requested allocation (USDT)" type="number" min="0" max="1000000" step="0.01" placeholder="0.00" value={budget} onChange={event => setBudget(event.target.value)} /></label>
            <fieldset><legend className="mb-2 text-xs font-medium text-muted-foreground">Preferred maximum leverage</legend><div className="grid grid-cols-4 gap-1 rounded-md border border-border bg-surface p-1" role="radiogroup" aria-label="Preferred maximum leverage">{([1, 2, 5, 10] as const).map(value => <Button key={value} variant="ghost" className={`h-9 rounded-sm font-mono text-xs hover:bg-surface-raised hover:text-foreground ${value === leverage ? "bg-bull/10 text-bull ring-1 ring-inset ring-bull/30" : "text-muted-foreground"}`} role="radio" aria-checked={value === leverage} onClick={() => setLeverage(value)}>{value}x</Button>)}</div></fieldset>
          </section>
          <p className="flex gap-3 border-l-2 border-border bg-surface px-3 py-3 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span><strong className="block font-medium text-foreground">Risk disclosure</strong>Historical results are not a guarantee. Preferences are non-binding. No automatic orders, wallet allocation, or 10 USDT loss protection is active.</span></p>
        </> : <p className="text-sm text-muted-foreground">{program === "tournament" ? "Proposed 50,000 USDT prize pool. Funding, competition dates, eligibility and payout rules are not approved. Registration does not enter an active competition or entitle you to prizes." : "Proposed zero-fee maker orders for qualified accounts. Qualification and fee terms are not approved. Applying does not change your current fees."}</p>}
        {existing && <p className="text-xs text-muted-foreground">Request pending{program === "copy_trading" ? ` · ${Number(existing.requested_budget).toFixed(2)} USDT · ${existing.leverage}x` : ""}</p>}
        <div className="border-t border-border pt-5"><Button className="min-h-11 w-full rounded-md sm:w-auto" disabled={busy} onClick={() => void submit()}>{busy ? "Saving..." : program === "copy_trading" ? "Save copy preferences" : program === "tournament" ? "Register interest" : "Submit interest"}<ArrowRight className="size-4" /></Button></div>
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
      </>}
      </div>
    </DialogContent>
  </Dialog>;
}