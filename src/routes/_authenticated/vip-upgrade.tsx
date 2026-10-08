import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Crown, Headset, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { QuickDepositDialog } from "@/components/home/QuickDepositDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { getProfileOverview } from "@/lib/profile.functions";
import { VIP1_PERKS, VIP1_THRESHOLD_USDT, isVip, isVipPending } from "@/lib/vip-tiers";

export const Route = createFileRoute("/_authenticated/vip-upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade to VIP - benefits & thresholds | Velocity Trade" },
      {
        name: "description",
        content:
          "Unlock VIP on Velocity Trade with a 20,000 USDT balance: zero trading fees, a priority account manager, elevated withdrawal limits and exclusive scalp return rates.",
      },
      { property: "og:title", content: "Upgrade to VIP - Velocity Trade" },
      {
        property: "og:description",
        content:
          "Zero trading fees, priority account manager, elevated limits and exclusive scalp return rates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VipUpgradePage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

const LADDER: { key: string; label: string; threshold: number; target?: boolean; plus?: boolean }[] = [
  { key: "vip1", label: "VIP 1", threshold: 10_000 },
  { key: "vip2", label: "VIP 2", threshold: VIP1_THRESHOLD_USDT, target: true },
  { key: "vip3", label: "VIP 3", threshold: 50_000 },
  { key: "vip4", label: "VIP Institutional", threshold: 100_000, plus: true },
];

const FEE_ROWS: { label: string; standard: string; vip: string }[] = [
  { label: "Spot maker fee", standard: "Standard rate", vip: "0.00%" },
  { label: "Spot taker fee", standard: "Standard rate", vip: "0.00%" },
  { label: "Scalp contract returns", standard: "Standard payouts", vip: "Boosted returns" },
  { label: "Daily withdrawal limit", standard: "Standard limit", vip: "Elevated limit" },
];

const fmt = (n: number, max = 2) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: max });

function VipUpgradePage() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 15_000,
  });
  const [depositOpen, setDepositOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const tier = (overview.data?.profile as any)?.vipTier ?? "regular";
  const balance = Number(overview.data?.balances?.totalUsdt ?? 0);
  const remaining = Math.max(0, VIP1_THRESHOLD_USDT - balance);
  const progress = Math.min(100, (balance / VIP1_THRESHOLD_USDT) * 100);
  const already = isVip(tier);
  const awaiting = isVipPending(tier);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-5 [touch-action:manipulation]">
        <button
          onClick={() => navigate({ to: "/profile" })}
          className="inline-flex touch-manipulation items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Profile
        </button>

        <header>
          <h1 className="font-display text-2xl font-bold tracking-tight">Upgrade to VIP</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fund your account to the VIP threshold and your tier activates automatically once your
            deposit clears.
          </p>
        </header>

        {/* Progression ladder */}
        <section className="rounded-2xl border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            VIP progression ladder
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {LADDER.map((step) => {
              const reached = balance >= step.threshold;
              return (
                <li
                  key={step.key}
                  className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                    step.target
                      ? "border-amber-500/40 bg-amber-500/5"
                      : reached
                        ? "border-bull/30 bg-bull/5"
                        : "border-border bg-secondary/30"
                  }`}
                >
                  <span
                    className={`grid size-9 shrink-0 place-items-center rounded-full ${
                      reached
                        ? "bg-gradient-to-br from-amber-300 to-amber-600 text-black"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {reached ? <Check className="size-4" /> : <Crown className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-bold">
                      {step.label}
                      {step.target && (
                        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-500">
                          Current target
                        </span>
                      )}
                    </p>
                    <p className="num text-xs text-muted-foreground">
                      {fmt(step.threshold, 0)}
                      {step.plus ? "+" : ""} USDT balance
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Tier card with live tracker */}
        <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-card">
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-amber-500/15 to-transparent p-5">
            <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-black shadow-lg">
              <Crown className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">VIP</p>
              <p className="text-xs uppercase tracking-widest text-amber-500">Membership tier</p>
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Required threshold
                </p>
                <p className="num font-display text-xl font-bold">
                  {VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT
                </p>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="num mt-2 text-xs text-muted-foreground">
                {already
                  ? "VIP is active on this account."
                  : awaiting
                    ? "Threshold reached - your VIP upgrade request is pending review."
                    : `${fmt(balance)} / ${fmt(VIP1_THRESHOLD_USDT, 0)} USDT (${Math.round(progress)}% Progress) - ${fmt(remaining)} USDT remaining.`}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Exclusive perks
              </p>
              <ul className="mt-3 space-y-2.5">
                {VIP1_PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-sm">
                    <Check className="mt-0.5 size-4 shrink-0 text-bull" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {already ? (
              <button
                onClick={() => setChatOpen(true)}
                className="inline-flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Headset className="size-4" /> Contact VIP Account Manager
              </button>
            ) : (
              <button
                disabled={awaiting}
                onClick={() => setDepositOpen(true)}
                className="w-full touch-manipulation rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {awaiting ? "VIP request pending approval" : "Deposit to Activate VIP"}
              </button>
            )}
          </div>
        </section>

        {/* Fee comparison */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border p-5">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              VIP fee comparison
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Benefit</th>
                  <th className="px-5 py-3 font-semibold">Standard</th>
                  <th className="px-5 py-3 font-semibold text-amber-500">VIP</th>
                </tr>
              </thead>
              <tbody>
                {FEE_ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border/60 last:border-0">
                    <td className="px-5 py-3 font-medium">{row.label}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.standard}</td>
                    <td className="num px-5 py-3 font-semibold text-bull">{row.vip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Once your deposit clears and your balance reaches the threshold, your VIP request is
          submitted for review. You will receive an in-app alert as soon as it is approved.
        </p>
      </div>

      <QuickDepositDialog open={depositOpen} onOpenChange={setDepositOpen} />
      <VipChatDialog open={chatOpen} onOpenChange={setChatOpen} />
    </AppShell>
  );
}
