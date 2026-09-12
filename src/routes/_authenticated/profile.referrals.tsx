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
      { property: "og:title", content: "Referral Program — Velocity Trade" },
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

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Traders invited" value={String(overview.data?.referrals.invited ?? 0)} />
        <Card
          title="Rewards earned"
          value={formatMoney(overview.data?.referrals.rewards ?? 0, "USDT")}
          tone="text-bull"
        />
        <Card title="Your code" value={code || "—"} hint="Share this with friends" />
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
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-xs"
          />
          <button
            onClick={() => link && copy(link, "Referral link")}
            disabled={!link}
            className="inline-flex touch-manipulation items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Copy className="size-4" /> Copy link
          </button>
        </div>
      </Section>

      <Section icon={Users} title="How rewards work">
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>1. Share your link — your friend signs up and verifies their identity.</li>
          <li>2. They fund their wallet and start trading.</li>
          <li>3. Your USDT reward is credited automatically to your funding wallet.</li>
        </ul>
      </Section>
    </>
  );
}
