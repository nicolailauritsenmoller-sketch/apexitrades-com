import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Building2, Handshake, Layers3, Info, RefreshCw, Crown } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { membershipOptions } from "@/lib/prime-membership-query";
import { collateralProgress } from "@/lib/prime-tiers";
import { isVip, isVipPending } from "@/lib/vip-tiers";
import { supabase } from "@/integrations/supabase/client";
import { vipEthBalance } from "@/lib/vip-portal-metrics";
import { useVipEcosystem } from "@/lib/use-vip-ecosystem";
import { InstitutionalCreditDialog } from "@/components/InstitutionalCreditDialog";

const description = "Velocity Trade VIP Portal: live account standing, collateral progression, withdrawal limit status and institutional service availability.";
export const Route = createFileRoute("/_authenticated/vip-portal")({
  head: () => ({ meta: [
    { title: "VIP Portal | Velocity Trade" }, { name: "description", content: description },
    { property: "og:title", content: "VIP Portal | Velocity Trade" }, { property: "og:description", content: description },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: VipPortalPage,
});

const fmt = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });
const services = [
  { name: "Institutional Loan", icon: Building2, detail: "Institutional lending is not provisioned. No loan application or borrowing entitlement is currently available." },
  { name: "OTC Trading Platform", icon: Handshake, detail: "A dedicated OTC execution service is not provisioned. Existing platform markets remain available through the trading terminal." },
  { name: "Spot Block Matching", icon: Layers3, detail: "Spot block matching is not provisioned. This listing does not authorize block orders or grant matching priority.", isNew: true },
];

function VipPortalPage() {
  const membership = useQuery(membershipOptions);
  const data = membership.data;
  const config = useVipEcosystem();
  const PRIME_TIERS = (data?.architecture ?? []).map(t => ({ ...t, threshold: Math.max(Number(t.min_portfolio_usdt),Number(t.min_collateral_usdt)) }));
  const [page, setPage] = useState(0);
  const [depositOpen, setDepositOpen] = useState(false);
  const [service, setService] = useState<(typeof services)[number] | null>(null);
  const carousel = useRef<HTMLDivElement>(null);
  const account = useQuery({
    queryKey: ["vip-portal-account", data?.userId],
    enabled: Boolean(data?.userId),
    refetchInterval: 5_000,
    queryFn: async () => {
      if (!data?.userId) return null;
      const [wallets, limit] = await Promise.all([
        supabase.from("wallets").select("currency,balance").eq("user_id", data.userId),
        supabase.from("user_withdrawal_limits").select("daily_limit_usdt").eq("user_id", data.userId).maybeSingle(),
      ]);
      return {
        eth: wallets.error ? null : vipEthBalance(wallets.data ?? []),
        limit: limit.error ? null : limit.data?.daily_limit_usdt ?? null,
        limitUnavailable: Boolean(limit.error),
      };
    },
  });
  const standing = data ? isVip(data.status) ? "VIP" : isVipPending(data.status) ? "VIP (PENDING)" : "Regular" : "...";
  const tiers = data ? PRIME_TIERS.filter(t => t.level > Number(data.account?.level ?? 0)) : PRIME_TIERS;
  const slides = tiers.length ? tiers : PRIME_TIERS.slice(-1);
  const goTo = (index: number) => carousel.current?.scrollTo({ left: index * carousel.current.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });

  return <AppShell><div className="mx-auto max-w-3xl pb-8 touch-manipulation">
    <header className="mb-7 flex items-center justify-between border-b border-border pb-4"><Button asChild variant="ghost" size="sm" className="-ml-3"><Link to="/vip-upgrade"><ArrowLeft /> VIP Memberships</Link></Button><h1 className="text-lg">VIP Portal</h1></header>
    <div className="mb-6 flex items-center justify-between"><h2 className="text-lg">Dashboard</h2><Button variant="ghost" size="icon" aria-label="Refresh VIP account" onClick={() => { void membership.refetch(); void account.refetch(); }}><RefreshCw className={membership.isFetching ? "animate-spin motion-reduce:animate-none" : ""} /></Button></div>
    <section aria-labelledby="my-account-title" className="mb-6">
      <h2 id="my-account-title" className="mb-5 flex flex-wrap items-center gap-3 text-xl">My Account <span role="img" aria-label={`Account standing: ${standing}`} title={standing} className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-ops-amber-bg bg-ops-amber/10 text-ops-amber"><Crown className="size-4" strokeWidth={1.5} aria-hidden="true" /></span></h2>
      <dl className="grid grid-cols-2 gap-5"><div hidden={!config.data?.showEth}><dt className="text-xs text-muted-foreground">ETH Balance</dt><dd className="num mt-2 text-lg">{account.data?.eth == null ? "Unavailable" : fmt(account.data.eth)}</dd></div><div><dt className="text-xs text-muted-foreground">24H Withdrawal Limit</dt><dd className="num mt-2 text-sm font-semibold">{(config.data?.withdrawalLimit ?? 5_000_000).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</dd><p className="mt-1 text-xs text-muted-foreground">{account.data?.limit != null ? `Account cap: ${fmt(account.data.limit)} USDT` : "Account-specific restrictions apply."}</p><Link to="/profile/verification" className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">Verification & limits <ChevronRight className="size-3" /></Link></div></dl>
    </section>
    {!data ? <div role={membership.isError ? "alert" : "status"} className="py-6 text-sm text-muted-foreground">{membership.isError ? "VIP account status is temporarily unavailable." : "Loading account progression..."}</div> : <section aria-label="VIP tier progression" className="overflow-hidden rounded-lg border border-border bg-card">
      <div ref={carousel} className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar" onScroll={event => setPage(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}>
        {slides.map(tier => {
          const threshold = tier.threshold;
          const progress = collateralProgress(data.clearedBalance, threshold);
          return <div key={tier.level} className="w-full min-w-0 shrink-0 snap-start p-5 sm:p-6">
            <h2 className="text-xl">{tiers.length ? "Level up to the next VIP Tier" : "Your Prime allocation"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{tier.name}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Cleared collateral is evaluated live. Allocation requires review; funding does not activate benefits automatically.</p>
            <div hidden={!config.data?.showEth} className="mt-6"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm">ETH holdings <Info className="size-3.5 text-muted-foreground" /></h3></div><p className="num mt-3 text-sm">{account.data?.eth == null ? "Unavailable" : `${fmt(account.data.eth)} ETH`} <span className="font-sans text-xs text-muted-foreground">/ {Number(tier.min_eth_holdings) > 0 ? `${Number(tier.min_eth_holdings)} ETH required` : "No ETH requirement"}</span></p><div className="mt-3 h-1.5 rounded-full bg-secondary" /><p className="mt-2 text-xs text-muted-foreground">ETH criteria follow the configured allocation policy.</p></div>
            <div className="mt-6"><div className="flex items-center justify-between gap-3"><h3 className="text-sm">Cleared Asset Collateral</h3><Button className="min-h-10" onClick={() => setDepositOpen(true)}>Deposit</Button></div><p className="num mt-3 text-sm">{data.valuationComplete ? `${fmt(data.clearedBalance)} / ${fmt(threshold)} USDT` : "Valuation unavailable"}</p><div role="progressbar" aria-label={`${tier.name} collateral`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={data.valuationComplete ? Math.round(progress.percent) : 0} className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-ops-amber" style={{ width: `${data.valuationComplete ? progress.percent : 0}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">30D Average Asset: not tracked for this allocation. Current cleared balances are used.</p></div>
          </div>;
        })}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3"><span className="text-xs text-muted-foreground">Prime Tier Architecture</span><div className="flex items-center gap-1"><Button variant="ghost" size="icon" className="size-8" aria-label="Previous allocation tier" disabled={page === 0} onClick={() => goTo(page - 1)}><ChevronLeft /></Button>{slides.map((t, index) => <Button key={t.level} variant="ghost" size="icon" className="size-6" aria-label={`View ${t.name}`} aria-pressed={page === index} onClick={() => goTo(index)}><span className={`h-1 w-3 rounded-full ${page === index ? "bg-ops-amber" : "bg-muted-foreground/30"}`} /></Button>)}<Button variant="ghost" size="icon" className="size-8" aria-label="Next allocation tier" disabled={page >= slides.length - 1} onClick={() => goTo(page + 1)}><ChevronRight /></Button></div></div>
    </section>}
    <section className="mt-8" aria-labelledby="exclusive-title"><h2 id="exclusive-title" className="mb-4 text-xl">VIP Exclusive</h2><div className="space-y-3">{services.map(item => <Button key={item.name} variant="outline" className="h-auto min-h-20 w-full justify-start gap-4 rounded-lg bg-card p-4 text-left" onClick={() => setService(item)}><item.icon className="size-6 shrink-0 text-ops-amber" /><span className="flex-1 whitespace-normal"><span className="block text-sm font-medium">{item.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{item.name === "Institutional Loan" ? "Credit facility simulation" : "Not provisioned"}</span></span>{item.isNew && <span className="rounded-sm bg-bear/10 px-2 py-1 text-xs text-bear">New</span>}<ChevronRight className="size-4 shrink-0 text-muted-foreground" /></Button>)}</div></section>
    <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
    <InstitutionalCreditDialog open={service?.name === "Institutional Loan"} onOpenChange={open => { if (!open) setService(null); }} />
    <Dialog open={service !== null && service.name !== "Institutional Loan"} onOpenChange={open => { if (!open) setService(null); }}><DialogContent><DialogHeader><DialogTitle>{service?.name}</DialogTitle><DialogDescription>{service?.detail}</DialogDescription></DialogHeader><Button asChild variant="outline"><Link to="/profile/support">Contact support <ChevronRight /></Link></Button></DialogContent></Dialog>
  </div></AppShell>;
}