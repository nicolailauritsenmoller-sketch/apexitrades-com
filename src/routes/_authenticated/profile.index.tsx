import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  Copy,
  Gift,
  HelpCircle,
  LifeBuoy,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { Card, KYC_LABEL, KYC_TONE, NavTile, copy } from "@/components/profile/ui";
import { formatMoney } from "@/lib/instruments";
import { getProfileOverview, updateProfile } from "@/lib/profile.functions";
import { getMyKyc } from "@/lib/kyc.functions";
import { getMyAccess } from "@/lib/admin.functions";
import {
  CREDIT_SCORE_MAX,
  CREDIT_SCORE_MIN,
  MIN_WITHDRAWAL_CREDIT_SCORE,
  creditScoreBand,
} from "@/lib/limits";
import { registerCurrentDevice } from "@/lib/sessions";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "My Profile — identity, security & referrals | Velocity Trade" },
      {
        name: "description",
        content:
          "Manage your Velocity Trade account: identity verification, wallet balances, security centre, referral rewards and settings.",
      },
      { property: "og:title", content: "My Profile — Velocity Trade" },
      {
        property: "og:description",
        content: "Identity verification, balances, security, referrals and account settings.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileHome,
});

function ProfileHome() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const fetchKyc = useServerFn(getMyKyc);
  const saveProfile = useServerFn(updateProfile);
  const fetchAccess = useServerFn(getMyAccess);

  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });
  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  const access = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    retry: false,
    staleTime: 60_000,
  });

  const profile = overview.data?.profile;
  const balances = overview.data?.balances;
  const metrics = overview.data?.metrics;

  useEffect(() => {
    if (!profile?.id) return;
    registerCurrentDevice(profile.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["sessions"] }))
      .catch(() => undefined);
  }, [profile?.id, queryClient]);

  const [displayName, setDisplayName] = useState("");
  const nameLockedDays = (() => {
    const until = (profile as any)?.nameLockedUntil;
    if (!until) return 0;
    const diff = new Date(until).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 86_400_000) : 0;
  })();
  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  const nameMutation = useMutation({
    mutationFn: (name: string) => saveProfile({ data: { displayName: name } }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = kyc.data?.status ?? "unverified";
  const creditScore = Number((profile as any)?.creditScore ?? 750);
  const creditBand = creditScoreBand(creditScore);

  return (
    <>
      {/* Identity header */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar className="size-16" alt="Account avatar" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-bold tracking-tight">
                {profile?.displayName ?? "Trader"}
              </h1>
              {status === "approved" && <VerifiedBadge />}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[status]}`}
              >
                {KYC_LABEL[status] ?? status}
              </span>
              <span
                className={`rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest ${creditBand.tone}`}
                title="Account credit score"
              >
                Credit {creditScore} · {creditBand.label}
              </span>
            </div>
            <p className="truncate text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
            <button
              onClick={() => profile?.uid && copy(profile.uid, "UID")}
              className="mt-1 inline-flex touch-manipulation items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold tracking-wide"
            >
              UID: #{profile?.uid ?? "—"}
              <Copy className="size-3" />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            disabled={nameLockedDays > 0}
            placeholder="Display name"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
          <button
            onClick={() => nameMutation.mutate(displayName)}
            disabled={nameMutation.isPending || displayName.trim().length < 2 || nameLockedDays > 0}
            className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save name
          </button>
        </div>
        {nameLockedDays > 0 ? (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-500">
            Name locked · {nameLockedDays} day{nameLockedDays === 1 ? "" : "s"} remaining
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Your display name can only be changed once every 60 days.
          </p>
        )}
      </section>

      {/* Financial dashboard */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Total portfolio"
          value={formatMoney(balances?.totalUsdt ?? 0, "USDT")}
          hint="Spot + futures + funding"
        />
        <Card title="Spot wallet" value={formatMoney(balances?.spotUsdt ?? 0, "USDT")} />
        <Card
          title="Futures wallet"
          value={formatMoney(balances?.futuresUsdt ?? 0, "USDT")}
          hint={`${metrics?.openContracts ?? 0} contracts · ${metrics?.openPositions ?? 0} positions`}
        />
        <Card
          title="Funding wallet"
          value={formatMoney(balances?.fundingUsdt ?? 0, "USDT")}
          hint="Deposits awaiting approval"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card
          title="Today's P/L"
          value={`${formatMoney(metrics?.todayPnl ?? 0, "USDT")} (${(metrics?.todayPnlPct ?? 0).toFixed(2)}%)`}
          tone={(metrics?.todayPnl ?? 0) >= 0 ? "text-bull" : "text-bear"}
        />
        <Card
          title="Total profit / loss"
          value={formatMoney(metrics?.totalPnl ?? 0, "USDT")}
          tone={(metrics?.totalPnl ?? 0) >= 0 ? "text-bull" : "text-bear"}
        />
        <Card
          title="Total assets"
          value={`${balances?.wallets.filter((w) => w.balance > 0).length ?? 0} funded`}
          hint={balances?.wallets.map((w) => w.currency).join(" · ")}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Account credit score
            </p>
            <p className={`font-display text-2xl font-bold ${creditBand.tone}`}>
              {creditScore}{" "}
              <span className="text-sm font-medium text-muted-foreground">{creditBand.label}</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Withdrawals require an approved KYC and a score of at least{" "}
            {MIN_WITHDRAWAL_CREDIT_SCORE}.
          </p>
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, ((creditScore - CREDIT_SCORE_MIN) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Category navigation */}
      <div className="grid gap-3 md:grid-cols-2">
        <NavTile
          to="/profile/verification"
          icon={BadgeCheck}
          title="Account verification"
          description="Submit identity details and upload your documents."
          badge={KYC_LABEL[status] ?? status}
          badgeTone={KYC_TONE[status]}
        />
        <NavTile
          to="/profile/security"
          icon={ShieldCheck}
          title="Security center"
          description="Active sessions, login history and 2FA status."
        />
        <NavTile
          to="/profile/referrals"
          icon={Gift}
          title="Referral program"
          description="Your referral link, invite stats and rewards earned."
        />
        <NavTile
          to="/profile/settings"
          icon={Settings}
          title="Settings"
          description="Security, notifications and display preferences."
        />
        <NavTile
          to="/profile/help"
          icon={HelpCircle}
          title="Help center"
          description="FAQs, platform documentation and legal policies."
        />
        <NavTile
          to="/profile/support"
          icon={LifeBuoy}
          title="Contact support"
          description="Submit a ticket or open live chat with an agent."
        />
      </div>

      {access.data?.isStaff ? (
        <Link
          to="/sys-portal-x97"
          className="inline-flex touch-manipulation items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <ShieldCheck className="size-4" /> Open Admin Panel
        </Link>
      ) : null}
    </>
  );
}
