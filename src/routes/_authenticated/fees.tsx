import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ChevronRight, RefreshCw, BadgeCheck, Info } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { membershipOptions } from "@/lib/prime-membership-query";
import { displayedFeeRate } from "@/lib/fee-discount";


const description = "Velocity Trade configured maker and taker fee percentages across spot, stocks, futures and scalping, with VIP collateral requirements.";
export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({ meta: [
    { title: "Fee Rate Schedule | Velocity Trade" },
    { name: "description", content: description },
    { property: "og:title", content: "Fee Rate Schedule | Velocity Trade" },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: FeeSchedulePage,
});

const markets = [
  { id: "spot", label: "Spot & Margin" },
  { id: "stocks", label: "Stocks" },
  { id: "futures", label: "USDⓈ-M Futures" },
  { id: "coin", label: "COIN-M Futures" },
  { id: "scalp", label: "Scalping" },
] as const;
const tabStyle = "min-h-11 shrink-0 rounded-none border-b-2 border-transparent px-0 text-muted-foreground data-[state=active]:border-ops-amber data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none";
const pct = (value: number | string | null | undefined) => value == null || !Number.isFinite(Number(value)) ? "Not configured" : `${Number(value).toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 5 })}%`;

function FeeSchedulePage() {
  const membership = useQuery(membershipOptions);
  const [market, setMarket] = useState("spot");
  const [ethDiscount, setEthDiscount] = useState(false);
  const feePct = (value: number | string | null | undefined) => pct(displayedFeeRate(value, ethDiscount));
  const data = membership.data;
  const product = market === "futures" ? "futures" : market === "scalp" ? "scalp" : "spot";
  return <AppShell><div className="vip-ref mx-auto max-w-4xl pb-8 touch-manipulation">
    <div className="mb-6 flex items-center justify-between border-b border-border pb-4"><Button asChild variant="ghost" size="sm" className="-ml-3"><Link to="/vip-upgrade"><ArrowLeft /> VIP Memberships</Link></Button><span className="text-sm font-semibold">Fees</span></div>
    <header className="mb-5 flex items-center justify-between gap-3"><h1 className="text-2xl font-medium">Fee Rate</h1><Button asChild variant="ghost" size="sm"><Link to="/profile/referrals">Invite Friends <ChevronRight /></Link></Button></header>
    <Tabs defaultValue="trading">
      <div className="overflow-x-auto no-scrollbar border-b border-border"><TabsList className="h-auto w-max justify-start gap-7 rounded-none bg-transparent p-0" aria-label="Fee programs">
        <TabsTrigger className={tabStyle} value="trading">Trading</TabsTrigger><TabsTrigger className={tabStyle} value="promotions">Spot Promotions</TabsTrigger><TabsTrigger className={tabStyle} value="liquidity">Liquidity Program</TabsTrigger><TabsTrigger className={tabStyle} value="funding">Deposits & Withdrawals</TabsTrigger>
      </TabsList></div>
      <TabsContent value="trading" className="mt-3">
        <Tabs value={market} onValueChange={setMarket}>
          <div className="overflow-x-auto no-scrollbar"><TabsList aria-label="Fee markets" className="h-auto w-max justify-start gap-6 rounded-none bg-transparent p-0">{markets.map(m => <TabsTrigger key={m.id} value={m.id} className={tabStyle}>{m.label}</TabsTrigger>)}</TabsList></div>
        </Tabs>
        <div className="mt-5 flex items-center justify-between gap-4 border-y border-border py-4"><div className="min-w-0"><label htmlFor="eth-discount" className="text-sm font-medium">Pay fees with ETH</label><p id="eth-discount-status" aria-live="polite" className={`mt-1 text-xs ${ethDiscount ? "text-vip-gold" : "text-muted-foreground"}`}>{ethDiscount ? "ETH fee discount active (25% off applied to trading fees)" : "ETH fee discount off (standard trading fees shown)"}</p><p className="mt-1 text-xs text-muted-foreground">Fee schedule preview only. ETH payment and execution discounts are not enabled.</p></div><Switch id="eth-discount" checked={ethDiscount} onCheckedChange={setEthDiscount} aria-label="Pay fees with ETH" aria-describedby="eth-discount-status" className="data-[state=checked]:bg-vip-gold" /></div>
        {market === "coin" ? <div className="py-8"><h2 className="text-lg">COIN-M Futures</h2><p className="mt-2 text-sm text-muted-foreground">Coin-margined execution is not supported. No COIN-M fee schedule is configured.</p></div> : <>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info className="size-4 shrink-0" />{market === "stocks" ? "Unleveraged stocks use the spot fee schedule. Leveraged positions use the futures schedule." : market === "spot" ? "Unleveraged positions use spot rates. Leveraged margin positions use futures rates." : market === "scalp" ? "Account trading fees shown below. Duration-specific protocol fees may also apply and appear before order confirmation." : "Platform futures and leveraged positions use the configured futures rates."}</p>
          {!data ? <div className="py-8" role={membership.isError ? "alert" : "status"}><p className="text-sm text-muted-foreground">{membership.isError ? "Fee schedule is temporarily unavailable." : "Loading configured fee rates..."}</p>{membership.isError && <Button variant="outline" className="mt-3" onClick={() => void membership.refetch()}><RefreshCw /> Retry</Button>}</div> : <div>
            {data.schedule.map(tier => {
              const architecture = data.architecture.find(t => t.level === tier.level);
              const maker = tier[`${product}_maker`];
              const taker = tier[`${product}_taker`];
              const active = Number(data.account?.level ?? 0) === tier.level;
              return <section key={tier.level} aria-labelledby={`fee-tier-${tier.level}`} className="border-b border-border py-6">
                <div className="mb-5 flex flex-wrap items-center gap-2"><h2 id={`fee-tier-${tier.level}`} className="text-lg font-semibold">{tier.level === 0 ? "Regular User" : `VIP ${tier.level}`}</h2>{active && <BadgeCheck className="size-4 text-bull" aria-label="Current allocated schedule" />}{architecture && <span className="text-xs text-muted-foreground">{architecture.name}</span>}</div>
                <dl className="space-y-4 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2"><dt className="text-muted-foreground">Minimum AUM / Collateral</dt><dd className="num text-right">{tier.level === 0 ? "No minimum" : `${Number(tier.min_portfolio_usdt).toLocaleString("en-US")} USDT`}</dd></div>
                  <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Maker / Taker</dt><dd className="num text-right">{feePct(maker)} / {feePct(taker)}</dd></div>
                  {market === "spot" && <div className="flex items-baseline justify-between gap-4"><dt className="text-muted-foreground">Margin Maker / Taker</dt><dd className="num text-right">{feePct(tier.futures_maker)} / {feePct(tier.futures_taker)}</dd></div>}
                </dl>
                {Number(maker) < 0 && <p className="mt-3 text-xs text-bull">Negative maker rates represent rebates.</p>}
              </section>;
            })}
            <p className="mt-5 text-xs leading-relaxed text-muted-foreground">{ethDiscount ? "Displayed positive maker and taker rates include the 25% ETH discount preview; zero fees and maker rebates are unchanged." : "Configured base rates are shown."} Not a quote for a specific order. Account-specific fee overrides and approved discounts take precedence. VIP allocation requires review; collateral alone does not activate a fee tier.</p>
          </div>}
        </>}
      </TabsContent>
      <TabsContent value="promotions" className="py-8"><h2>Spot Promotions</h2><p className="mt-2 text-sm text-muted-foreground">No active spot fee promotion is configured.</p></TabsContent>
      <TabsContent value="liquidity" className="py-8"><h2>Liquidity Program</h2><p className="mt-2 text-sm text-muted-foreground">Liquidity program fee entitlements are not provisioned. Configured trading rates remain in effect.</p><Button asChild variant="outline" className="mt-5"><Link to="/vip-upgrade">View membership allocation <ChevronRight /></Link></Button></TabsContent>
      <TabsContent value="funding" className="py-8"><h2>Deposits & Withdrawals</h2><p className="mt-2 text-sm text-muted-foreground">Network availability and applicable transfer fees are shown in the funding flow before confirmation.</p><Button asChild variant="outline" className="mt-5"><Link to="/wallet" search={{ tab: "deposit" }}>Open Assets <ChevronRight /></Link></Button></TabsContent>
    </Tabs>
  </div></AppShell>;
}