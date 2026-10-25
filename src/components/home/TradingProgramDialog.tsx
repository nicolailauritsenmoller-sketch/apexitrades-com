import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [applying, setApplying] = useState(false);
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
  return <Dialog open={program !== null} onOpenChange={open => { if (!open) { onClose(); setFeedback(""); setApplying(false); } }}>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg p-5">
      <DialogHeader><DialogTitle>{program ? titles[program] : "Trading programs"}</DialogTitle><DialogDescription>{program === "copy_trading" ? "Leader enrollment and copy preferences. Real-money execution is not enabled." : "Proposed program - registration of interest only."}</DialogDescription></DialogHeader>
      {query.isPending ? <p className="text-sm text-muted-foreground">Loading...</p> : query.isError ? <div role="alert" className="text-sm text-bear">Unable to load programs.<Button variant="ghost" onClick={() => query.refetch()}>Retry</Button></div> : <>
        {program === "copy_trading" ? <>
          <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">Lead trader directory</h2><Button variant="outline" size="sm" onClick={() => setApplying(!applying)}><Users className="size-4" />Become a lead trader</Button></div>
          <p className="text-xs text-muted-foreground">30-day closed-position return on committed margin, net of recorded fees. Historical results are not a guarantee. Rankings exclude scalp contracts.</p>
          {leaders.length === 0 ? <p className="border-y border-border py-6 text-sm text-muted-foreground">No approved lead traders yet. No performance figures are published.</p> : <div className="space-y-2">{leaders.map(leader => <Button key={leader.leader_id} variant="outline" aria-pressed={leaderId === leader.leader_id} onClick={() => setLeaderId(leader.leader_id)} className="h-auto w-full flex-col items-start whitespace-normal p-4 text-left"><span className="font-semibold">{leader.public_name}</span><span className="text-xs text-muted-foreground">{leader.bio}</span><span className="mt-2 text-xs">ROI {leader.roi_pct == null ? "Unavailable" : `${Number(leader.roi_pct).toFixed(2)}%`} · Win rate {leader.win_rate_pct == null ? "Unavailable" : `${Number(leader.win_rate_pct).toFixed(1)}%`} · {leader.closed_trades} closed trades</span></Button>)}</div>}
          {applying && <form onSubmit={event => { event.preventDefault(); void submit(true); }} className="space-y-3 border-b border-border pb-4">
            {query.data?.application ? <p className="text-sm">Leader application: {query.data.application.status}</p> : <><label className="block text-xs">Public trader name<Input value={publicName} onChange={event => setPublicName(event.target.value)} minLength={2} maxLength={60} required /></label><label className="block text-xs">Strategy summary<Input value={bio} onChange={event => setBio(event.target.value)} maxLength={400} /></label><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} required />I consent to publishing my trader name, strategy and historical position statistics after review.</label><Button disabled={busy || !consent} type="submit">Submit leader application</Button></>}
          </form>}
          <label className="block text-xs font-medium">Requested allocation (USDT)<Input aria-label="Requested allocation (USDT)" type="number" min="0" max="1000000" step="0.01" placeholder="0.00" value={budget} onChange={event => setBudget(event.target.value)} /></label>
          <fieldset><legend className="mb-2 text-xs font-medium">Preferred maximum leverage</legend><div className="flex gap-2" role="radiogroup" aria-label="Preferred maximum leverage">{([1, 2, 5, 10] as const).map(value => <Button key={value} variant={value === leverage ? "secondary" : "outline"} role="radio" aria-checked={value === leverage} onClick={() => setLeverage(value)}>{value}x</Button>)}</div></fieldset>
          <p className="flex gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0" />Preferences are non-binding. No automatic orders, wallet allocation, or 10 USDT loss protection is active.</p>
        </> : <p className="text-sm text-muted-foreground">{program === "tournament" ? "Proposed 50,000 USDT prize pool. Funding, competition dates, eligibility and payout rules are not approved. Registration does not enter an active competition or entitle you to prizes." : "Proposed zero-fee maker orders for qualified accounts. Qualification and fee terms are not approved. Applying does not change your current fees."}</p>}
        {existing && <p className="text-xs text-muted-foreground">Request pending{program === "copy_trading" ? ` · ${Number(existing.requested_budget).toFixed(2)} USDT · ${existing.leverage}x` : ""}</p>}
        <Button disabled={busy} onClick={() => void submit()}>{busy ? "Saving..." : program === "copy_trading" ? "Save copy preferences" : program === "tournament" ? "Register interest" : "Submit interest"}</Button>
        {feedback && <p role="status" className="text-sm">{feedback}</p>}
      </>}
    </DialogContent>
  </Dialog>;
}