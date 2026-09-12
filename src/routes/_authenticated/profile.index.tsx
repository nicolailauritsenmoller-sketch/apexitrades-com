import { useEffect } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Copy,
  HelpCircle,
  LogOut,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { KYC_LABEL, KYC_TONE, copy } from "@/components/profile/ui";
import { getProfileOverview } from "@/lib/profile.functions";
import { getMyKyc } from "@/lib/kyc.functions";
import { getMyAccess } from "@/lib/admin.functions";
import { CREDIT_SCORE_MAX, CREDIT_SCORE_MIN, creditScoreBand } from "@/lib/limits";
import { registerCurrentDevice } from "@/lib/sessions";
import { supabase } from "@/integrations/supabase/client";
import { clearQueryCachePersistence } from "@/lib/query-persist";
import { useRouter } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/profile/")({
  head: () => ({
    meta: [
      { title: "My Profile — identity, security & referrals | Velocity Trade" },
      {
        name: "description",
        content:
          "Manage your Velocity Trade account: identity verification, security centre, referral rewards, notifications and support.",
      },
      { property: "og:title", content: "My Profile — Velocity Trade" },
      {
        property: "og:description",
        content: "Identity verification, security, referrals and account settings.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfileHome,
});

function QuickTile({
  to,
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  to: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  tone: string;
}) {
  return (
    <Link
      to={to as never}
      className="flex touch-manipulation flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-4 text-center transition-colors hover:bg-secondary"
    >
      <Icon className={`size-5 ${tone}`} />
      <span className="text-[13px] font-semibold leading-tight">{title}</span>
      <span className="text-[10px] leading-tight text-muted-foreground">{subtitle}</span>
    </Link>
  );
}

function ListRow({
  to,
  icon: Icon,
  label,
  badge,
  badgeTone,
  last,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  badge?: string;
  badgeTone?: string;
  last?: boolean;
}) {
  return (
    <Link
      to={to as never}
      className={`flex touch-manipulation items-center gap-3 px-4 py-4 transition-colors hover:bg-secondary ${
        last ? "" : "border-b border-border"
      }`}
    >
      <Icon className="size-[18px] shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      {badge ? (
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${badgeTone ?? "border-border text-muted-foreground"}`}
        >
          {badge}
        </span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function ProfileHome() {
  const queryClient = useQueryClient();
  const router = useRouter();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    clearQueryCachePersistence();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  }

  const fetchOverview = useServerFn(getProfileOverview);
  const fetchKyc = useServerFn(getMyKyc);
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

  useEffect(() => {
    if (!profile?.id) return;
    registerCurrentDevice(profile.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["sessions"] }))
      .catch(() => undefined);
  }, [profile?.id, queryClient]);

  const status = kyc.data?.status ?? "unverified";
  const creditScore = Number((profile as any)?.creditScore ?? 750);
  const creditBand = creditScoreBand(creditScore);
  const creditPct = Math.min(
    100,
    Math.max(0, ((creditScore - CREDIT_SCORE_MIN) / (CREDIT_SCORE_MAX - CREDIT_SCORE_MIN)) * 100),
  );

  return (
    <>
      {/* Identity card */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-4">
          <UserAvatar className="size-16" alt="Account avatar" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-lg font-bold tracking-tight">
                {profile?.displayName ?? "Trader"}
              </h1>
              {status === "approved" ? (
                <VerifiedBadge />
              ) : (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[status]}`}
                >
                  {KYC_LABEL[status] ?? status}
                </span>
              )}
            </div>
          </div>
        </div>

        <p className="mt-3 truncate text-sm text-muted-foreground">{profile?.email ?? "—"}</p>
        <button
          onClick={() => profile?.uid && copy(profile.uid, "UID")}
          className="mt-2 inline-flex touch-manipulation items-center gap-1.5 rounded-md bg-secondary px-2.5 py-1.5 font-mono text-xs font-bold tracking-wide"
        >
          UID: #{profile?.uid ?? "—"}
          <Copy className="size-3" />
        </button>

        <div className="mt-4 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Credit Score</p>
          <div className="mt-1 flex items-center gap-3">
            <p className={`text-sm font-bold ${creditBand.tone}`}>
              {creditScore} · {creditBand.label}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-bull transition-all"
                style={{ width: `${creditPct}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Quick tiles */}
      <div className="grid grid-cols-3 gap-3">
        <QuickTile
          to="/profile/verification"
          icon={BadgeCheck}
          title="Account Verification"
          subtitle={status === "approved" ? "Verified" : "Verify identity"}
          tone="text-primary"
        />
        <QuickTile
          to="/profile/security"
          icon={ShieldCheck}
          title="Security Center"
          subtitle="Secure your account"
          tone="text-primary"
        />
        <QuickTile
          to="/profile/referrals"
          icon={Users}
          title="Referral Program"
          subtitle="Invite & earn rewards"
          tone="text-bull"
        />
      </div>

      {/* Settings list */}
      <section className="space-y-2">
        <h2 className="px-1 font-display text-base font-bold tracking-tight">Settings</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ListRow to="/profile/settings" icon={User} label="Personal Information" />
          <ListRow to="/profile/settings/security" icon={ShieldCheck} label="Security" />
          <ListRow to="/profile/settings/notifications" icon={Bell} label="Notifications" />
          <ListRow
            to="/profile/settings/preferences"
            icon={SlidersHorizontal}
            label="Preferences"
            last
          />
        </div>
      </section>

      {/* Support list */}
      <section className="space-y-2">
        <h2 className="px-1 font-display text-base font-bold tracking-tight">Support</h2>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <ListRow to="/profile/help" icon={HelpCircle} label="Help Center" />
          <ListRow to="/profile/support" icon={MessageSquare} label="Contact Support" last />
        </div>
      </section>

      {access.data?.isAdmin === true ? (
        <Link
          to="/sys-portal-x97"
          className="inline-flex touch-manipulation items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          <ShieldCheck className="size-4" /> Open Control Center
        </Link>
      ) : null}

      <button
        onClick={handleSignOut}
        className="mt-2 flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3.5 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
      >
        <LogOut className="size-4" /> Log Out
      </button>
    </>
  );
}
