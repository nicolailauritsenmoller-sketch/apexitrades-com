import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Clock3, Layers3, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { supabase } from "@/integrations/supabase/client";
import { getPrimeMembership, requestPrimeAllocation } from "@/lib/prime-membership.functions";
import { PRIME_TIERS, collateralProgress, feeBps } from "@/lib/prime-tiers";
import { isVip, isVipPending } from "@/lib/vip-tiers";

const membershipOptions = queryOptions({ queryKey: ["prime-membership"], queryFn: () => getPrimeMembership(), refetchInterval: 5_000 });
const description = "Prime Tier Architecture on Velocity Trade: collateral requirements, configured maker/taker fees and reviewed institutional tier allocations.";
export const Route = createFileRoute("/_authenticated/vip-upgrade")({
  head: () => ({ meta: [
    { title: "Institutional Tier Allocation | Velocity Trade" },
    { name: "description", content: description },
    { property: "og:title", content: "Prime Tier Architecture | Velocity Trade" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: VipUpgradePage,
  errorComponent: () => <AppShell><div role="alert" className="p-6 text-sm text-bear">Membership status is temporarily unavailable. Please reload to retry.</div></AppShell>,
});

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const feeRows = [
  { label: "Spot maker", key: "spot_maker" },
  { label: "Spot taker", key: "spot_taker" },
  { label: "Futures maker", key: "futures_maker" },
  { label: "Futures taker", key: "futures_taker" },
  { label: "Scalp maker", key: "scalp_maker" },
  { label: "Scalp taker", key: "scalp_taker" },
] as const;

function VipUpgradePage() {
  const membership = useQuery(membershipOptions);
  if (!membership.data) return <AppShell><div className="mx-auto max-w-6xl py-8" role={membership.isError ? "alert" : "status"}>
    <h1 className="text-2xl font-semibold">Institutional Tier Allocation</h1>
    <p className="mt-3 text-sm text-muted-foreground">{membership.isError ? "Membership status is temporarily unavailable." : "Loading membership status..."}</p>
    {membership.isError && <Button variant="outline" className="mt-4" onClick={() => void membership.refetch()}><RefreshCw /> Retry</Button>}
  </div></AppShell>;
  return <MembershipContent data={membership.data} isFetching={membership.isFetching} isError={membership.isError} />;
}

function MembershipContent({ data, isFetching, isError }: { data: Awaited<ReturnType<typeof getPrimeMembership>>; isFetching: boolean; isError: boolean }) {
  const qc = useQueryClient();
  const submit = useServerFn(requestPrimeAllocation);
  const currentLevel = Number(data.account?.level ?? 0);
  const recommended = data.account?.recommended_level;
  const initialTarget = recommended ?? Math.min(4, currentLevel + 1);
  const [selectedLevel, setSelectedLevel] = useState(initialTarget);
  const [depositOpen, setDepositOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const selected = PRIME_TIERS.find(t => t.level === selectedLevel) ?? PRIME_TIERS[0];
  const selectedFees = data.schedule.find(t => t.level === selected.level);
  const requirement = Number(selectedFees?.min_portfolio_usdt ?? selected.threshold);
  const progress = collateralProgress(data.clearedBalance, requirement);
  const approved = currentLevel >= selected.level;
  const pending = !approved && (recommended != null && recommended >= selected.level);
  const ready = progress.qualified && data.valuationComplete && !isError;
  const statusLabel = isVip(data.status) ? "VIP" : isVipPending(data.status) ? "VIP (PENDING)" : "STANDARD";
  const request = useMutation({
    mutationFn: () => submit({ data: { level: selected.level } }),
    onSuccess: async (result) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["prime-membership"] }), qc.invalidateQueries({ queryKey: ["profile-overview"] })]);
      toast.success(result.status === "active" ? "This allocation is already active." : "Allocation request submitted for review.");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Request could not be submitted."),
  });

  useEffect(() => {
    const refresh = () => { void qc.invalidateQueries({ queryKey: ["prime-membership"] }); void qc.invalidateQueries({ queryKey: ["profile-overview"] }); };
    const channel = supabase.channel(`prime-membership-${data.userId}`);
    for (const table of ["profiles", "wallets", "vip_accounts", "deposits", "notifications"] as const) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `${table === "profiles" ? "id" : "user_id"}=eq.${data.userId}` }, refresh);
    }
    channel.subscribe(status => { if (status === "SUBSCRIBED") refresh(); });
    return () => { void supabase.removeChannel(channel); };
  }, [data.userId, qc]);

  const rows = [
    ...feeRows.map(row => ({ label: row.label, values: PRIME_TIERS.map(t => feeBps(data.schedule.find(s => s.level === t.level)?.[row.key])) })),
    { label: "Depth-of-book priority routing", values: PRIME_TIERS.map(() => "Not enabled") },
    { label: "Dedicated FIX API gateway", values: PRIME_TIERS.map(() => "Not provisioned") },
    { label: "Collateral encumbrance limit", values: PRIME_TIERS.map(() => "No tier-specific limit") },
    { label: "Dedicated account manager", values: PRIME_TIERS.map(t => t.level >= 3 ? "Eligible for assignment" : "Support desk") },
  ];

  return <AppShell>
    <div className="mx-auto max-w-6xl space-y-7 touch-manipulation pb-5">
      <Button asChild variant="ghost" size="sm" className="-ml-3 text-muted-foreground"><Link to="/profile"><ArrowLeft /> Profile</Link></Button>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground"><Layers3 className="size-4" /> Prime Tier Architecture</p>
          <h1 className="font-display text-2xl font-semibold">Institutional Tier Allocation</h1>
          <p className="mt-2 text-sm text-muted-foreground">Collateral-based access. Quantified fees. Reviewed allocation.</p>
        </div>
        <div className="flex items-center gap-2 border-l border-border pl-4 text-xs font-semibold"><ShieldCheck className="size-4 text-bull" /> {statusLabel}</div>
      </header>

      <section aria-labelledby="architecture-title">
        <div className="mb-3 flex items-center justify-between gap-3"><h2 id="architecture-title" className="text-sm font-semibold">Allocation levels</h2><span className="text-xs text-muted-foreground">USDT collateral</span></div>
        <ol className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PRIME_TIERS.map(t => {
            const threshold = Number(data.schedule.find(s => s.level === t.level)?.min_portfolio_usdt ?? t.threshold);
            const reached = data.valuationComplete && data.clearedBalance >= threshold;
            const active = currentLevel >= t.level;
            const waiting = !active && recommended != null && recommended >= t.level;
            return <li key={t.level} className={`overflow-hidden rounded-lg border ${selected.level === t.level ? "border-foreground/40 bg-secondary/50" : "border-border bg-card"}`}>
              <Button variant="ghost" onClick={() => setSelectedLevel(t.level)} aria-pressed={selected.level === t.level} className="h-auto min-h-44 w-full flex-col items-start justify-between whitespace-normal rounded-none p-4 text-left hover:bg-secondary/50">
                <span className="flex w-full items-center justify-between text-xs text-muted-foreground"><span className="num">0{t.level}</span>{active ? <Check className="text-bull" /> : waiting ? <Clock3 /> : <ArrowUpRight />}</span>
                <span className="mt-3 min-h-10 text-sm font-semibold">{t.name}</span>
                <span className="num mt-3 text-lg font-semibold">{fmt(threshold)}{t.level === 4 ? "+" : ""} <span className="text-xs font-normal text-muted-foreground">USDT</span></span>
                <span className={`mt-2 text-xs ${active ? "text-bull" : "text-muted-foreground"}`}>{active ? "Allocated" : waiting ? "Pending review" : reached ? "Collateral requirement met" : "Collateral requirement"}</span>
              </Button>
            </li>;
          })}
        </ol>
      </section>

      <section className="grid gap-6 border-y border-border py-6 lg:grid-cols-[1.25fr_1fr]" aria-labelledby="evaluation-title">
        <div>
          <div className="flex items-center justify-between gap-3"><h2 id="evaluation-title" className="text-base font-semibold">Collateral evaluation</h2><Button variant="ghost" size="icon" aria-label="Refresh membership status" title="Refresh membership status" onClick={() => void qc.invalidateQueries({ queryKey: ["prime-membership"] })}><RefreshCw className={isFetching ? "animate-spin motion-reduce:animate-none" : ""} /></Button></div>
          <p className="mt-1 text-xs text-muted-foreground">{selected.name}</p>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Minimum AUM / Collateral Requirement</dt><dd className="num font-semibold">{fmt(requirement)} USDT</dd></div>
            <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">Cleared wallet collateral</dt><dd className="num font-semibold">{data.valuationComplete ? `${fmt(data.clearedBalance)} USDT` : "Valuation unavailable"}</dd></div>
          </dl>
          <div role="progressbar" aria-label="Collateral qualification" aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.valuationComplete ? Math.round(progress.percent) : 0} className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-bull transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${data.valuationComplete ? progress.percent : 0}%` }} /></div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><span>{data.valuationComplete ? `${Math.round(progress.percent)}% funded` : "Evaluation paused"}</span><span>{data.valuationComplete ? `${fmt(progress.remaining)} USDT remaining` : "Live conversion required"}</span></div>
          <p className="mt-4 text-xs text-muted-foreground">Pending deposits and open-position notional are excluded. Meeting the requirement does not activate a tier.</p>
          {isError && <p role="alert" className="mt-2 text-xs text-bear">Status refresh failed. Refresh before submitting an allocation request.</p>}
        </div>
        <div className="flex flex-col justify-between border-t border-border pt-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <h2 className="text-base font-semibold">Allocation review</h2>
            <ol className="mt-4 space-y-4 text-sm">
              {[{ label: "Collateral requirement", done: ready, text: ready ? "Verified against cleared balances" : "Awaiting eligible collateral" }, { label: "Review request", done: pending || approved, text: pending ? "Pending review" : approved ? "Reviewed" : "Not submitted" }, { label: "Tier allocation", done: approved, text: approved ? "Active" : "Approval required" }].map((step, i) => <li key={step.label} className="flex items-start gap-3"><span className={`grid size-6 shrink-0 place-items-center rounded-full border text-xs ${step.done ? "border-bull/40 bg-bull/10 text-bull" : "border-border text-muted-foreground"}`}>{step.done ? <Check className="size-3" /> : i + 1}</span><div><p className="font-medium">{step.label}</p><p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p></div></li>)}
            </ol>
          </div>
          <Button className="mt-5 h-11 w-full whitespace-normal" disabled={pending || request.isPending || isError || !data.valuationComplete} onClick={() => approved ? setChatOpen(true) : ready ? request.mutate() : setDepositOpen(true)}>{request.isPending ? "Submitting request..." : approved ? "Open VIP support" : pending ? "Allocation pending review" : ready ? "Request tier allocation" : "Add collateral"}<ChevronRight /></Button>
        </div>
      </section>

      <section aria-labelledby="matrix-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 id="matrix-title" className="text-base font-semibold">Quantitative fee & access matrix</h2><p className="mt-1 text-xs text-muted-foreground">Configured base rates. 1 basis point = 0.01%. Account-specific overrides take precedence.</p></div><span className="text-xs text-muted-foreground">Maker / taker schedule</span></div>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[880px] text-left text-xs">
            <thead className="bg-secondary/50"><tr className="border-b border-border"><th className="px-4 py-4 font-medium text-muted-foreground">Execution parameter</th>{PRIME_TIERS.map(t => <th key={t.level} className={`max-w-48 px-4 py-4 font-semibold ${selected.level === t.level ? "bg-secondary" : ""}`}>{t.name}</th>)}</tr></thead>
            <tbody>{rows.map(row => <tr key={row.label} className="border-b border-border/70 last:border-0"><th scope="row" className="px-4 py-3.5 font-medium">{row.label}</th>{row.values.map((value, i) => <td key={i} className={`px-4 py-3.5 ${i + 1 === selected.level ? "bg-secondary/30" : ""} ${value.includes("bps") ? "num text-foreground" : "text-muted-foreground"}`}>{value}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Routing priority and FIX access are not active entitlements. Collateral remains subject to existing margin and withdrawal controls. Account manager access requires an actual assignment.</p>
      </section>
      {data.account?.account_manager_name && currentLevel >= 3 && <section className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><div><p className="text-xs text-muted-foreground">Assigned account manager</p><p className="mt-1 text-sm font-medium">{data.account.account_manager_name}</p></div><Button variant="outline" onClick={() => setChatOpen(true)}>Contact support <ArrowUpRight /></Button></section>}
      <div className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 shrink-0 text-bull" /><p>Allocations are reviewed, not automatic. Your current trading fees remain in effect until approval.</p></div>
    </div>
    <QuickDepositDialog open={depositOpen} onOpenChange={open => { setDepositOpen(open); if (!open) void qc.invalidateQueries({ queryKey: ["prime-membership"] }); }} />
    <VipChatDialog open={chatOpen} onOpenChange={setChatOpen} />
  </AppShell>;
}
