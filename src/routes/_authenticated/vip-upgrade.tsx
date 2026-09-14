import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, Crown, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getProfileOverview } from "@/lib/profile.functions";
import { VIP1_PERKS, VIP1_THRESHOLD_USDT, isVip, isVipPending } from "@/lib/vip-tiers";

export const Route = createFileRoute("/_authenticated/vip-upgrade")({
  head: () => ({
    meta: [
      { title: "Upgrade to VIP 1 — tier benefits & thresholds | Velocity Trade" },
      {
        name: "description",
        content:
          "Unlock VIP 1 on Velocity Trade with a 20,000 USDT balance: zero trading fees, a priority account manager, elevated withdrawal limits and exclusive scalp return rates.",
      },
      { property: "og:title", content: "Upgrade to VIP 1 — Velocity Trade" },
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
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

function VipUpgradePage() {
  const navigate = useNavigate();
  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });

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

        {/* Tier card */}
        <section className="overflow-hidden rounded-2xl border border-amber-500/30 bg-card">
          <div className="flex items-center gap-3 border-b border-border bg-gradient-to-r from-amber-500/15 to-transparent p-5">
            <span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-black shadow-lg">
              <Crown className="size-6" />
            </span>
            <div>
              <p className="font-display text-lg font-bold tracking-tight">VIP 1</p>
              <p className="text-xs uppercase tracking-widest text-amber-500">Bronze / Silver tier</p>
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
              <p className="mt-2 text-xs text-muted-foreground">
                {already
                  ? "VIP 1 is active on this account."
                  : `Current balance ${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT · ${remaining.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT remaining.`}
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

            <button
              disabled={already}
              onClick={() =>
                navigate({
                  to: "/wallet",
                  search: { tab: "deposit", amount: VIP1_THRESHOLD_USDT },
                })
              }
              className="w-full touch-manipulation rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {already
                ? "VIP 1 already active"
                : `Confirm & Deposit ${VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT`}
            </button>
          </div>
        </section>

        <p className="flex items-start gap-2 rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Your tier upgrades automatically once the deposit passes clearing and your balance reaches
          the threshold. You will receive an in-app alert and a confirmation email.
        </p>
      </div>
    </AppShell>
  );
}
