import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Gift, Users } from "lucide-react";
import { Card, Section, SubPageHeader, copy } from "@/components/profile/ui";
import { formatMoney } from "@/lib/instruments";
import { getMyReferrals } from "@/lib/referrals.functions";

export const Route = createFileRoute("/_authenticated/profile/referrals")({
  head: () => ({
    meta: [
      { title: "Referral Program | Velocity Trade" },
      {
        name: "description",
        content:
          "Share your Velocity Trade referral link, track invited traders and see the USDT rewards you have earned.",
      },
      { property: "og:title", content: "Referral Program - Velocity Trade" },
      {
        property: "og:description",
        content: "Invite traders and earn USDT rewards on their activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReferralsPage,
});

function ReferralsPage() {
  const fetchReferrals = useServerFn(getMyReferrals);
  const overview = useQuery({
    queryKey: ["my-referrals"],
    queryFn: () => fetchReferrals(),
    refetchInterval: 60_000,
  });

  const code = overview.data?.code ?? "";
  const stats = overview.data?.stats;
  const reward = overview.data?.rewardAmount ?? 10;
  const rows = overview.data?.referrals ?? [];
  const link =
    typeof window !== "undefined" && code ? `${window.location.origin}/auth?ref=${code}` : "";

  return (
    <>
      <SubPageHeader
        title="Referral program"
        description="Invite traders and earn rewards when they fund and trade."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Traders invited" value={String(stats?.invited ?? 0)} />
        <Card
          title="Pending rewards"
          value={formatMoney(stats?.pendingRewards ?? 0, "USDT")}
          hint={`${stats?.pending ?? 0} awaiting release`}
        />
        <Card
          title="Total earned"
          value={formatMoney(stats?.earned ?? 0, "USDT")}
          tone="text-bull"
        />
        <button
          type="button"
          onClick={() => code && copyReferral(code, "Referral ID copied!")}
          disabled={!code}
          className="touch-manipulation text-left"
          aria-label="Copy referral ID"
        >
          <Card title="Your code (tap to copy)" value={code || "-"} hint={`${reward} USDT per referral`} />
        </button>
      </div>

      <Section
        icon={Gift}
        title="Your referral link"
        description="Anyone signing up through this link is credited to your account."
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            readOnly
            value={link || "Referral link unavailable"}
            onClick={() => link && copyReferral(link, "Referral link copied!")}
            className="flex-1 cursor-pointer rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={() => link && copyReferral(link, "Referral link copied!")}
            disabled={!link}
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Copy className="size-4" /> Copy link
          </button>
        </div>
      </Section>

      <Section icon={Users} title="Your invited traders">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No one has joined with your link yet. Share it to start earning {reward} USDT per
            verified trader.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.refereeName}</p>
                  <p className="text-xs text-muted-foreground">
                    Joined {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                    r.status === "rewarded"
                      ? "border-bull/40 bg-bull/10 text-bull"
                      : r.status === "rejected"
                        ? "border-bear/40 bg-bear/10 text-bear"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {r.status}
                </span>
                <span className="w-24 text-right text-sm font-semibold">
                  {formatMoney(r.rewardAmount, "USDT")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section icon={Gift} title="How rewards work">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>1. Share your link - your friend signs up and verifies their identity.</li>
          <li>2. Once their identity check passes, the referral becomes eligible.</li>
          <li>3. {reward} USDT is credited to your USDT wallet and logged in your history.</li>
        </ul>
      </Section>
    </>
  );
}
