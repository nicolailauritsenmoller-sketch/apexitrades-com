import { useEffect } from "react";
import { SupportUnreadBadge } from "@/components/support/SupportUnreadBadge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  Copy,
  Crown,
  Headphones,
  HelpCircle,
  Hourglass,
  Info,
  LogOut,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { KYC_LABEL, KYC_TONE, copy } from "@/components/profile/ui";
import { getProfileOverview } from "@/lib/profile.functions";
import { getMyKyc } from "@/lib/kyc.functions";
import { VIP_TIER_LABEL, isVip, isVipPending } from "@/lib/vip-tiers";
import { registerCurrentDevice } from "@/lib/sessions";
import { supabase } from "@/integrations/supabase/client";
import { clearQueryCachePersistence } from "@/lib/query-persist";
import { useRouter } from "@tanstack/react-router";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

const HEALTH_LABEL: Record<string, string> = {
  healthy: "Healthy",
  caution: "Caution",
  at_risk: "At risk",
};
const HEALTH_TONE: Record<string, string> = {
  healthy: "text-bull",
  caution: "text-amber-500",
  at_risk: "text-bear",
};
const RISK_LABEL: Record<string, string> = { low: "Low", moderate: "Moderate", high: "High" };
const RISK_TONE: Record<string, string> = {
  low: "text-bull",
  moderate: "text-amber-500",
  high: "text-bear",
};

function usd(value: number) {
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

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

  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });
  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });

  const profile = overview.data?.profile;

  useEffect(() => {
    if (!profile?.id) return;
    registerCurrentDevice(profile.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["sessions"] }))
      .catch(() => undefined);
  }, [profile?.id, queryClient]);

  const status = kyc.data?.status ?? "unverified";
  const enhancedStatus = kyc.data?.level2Status ?? "unsubmitted";
  const vipTier = String((profile as any)?.vipTier ?? "regular");
  const margin = overview.data?.risk.margin;
  const health = overview.data?.risk.accountHealth;
  const exposure = overview.data?.risk.exposure;
  const execution = overview.data?.risk.execution;
  const trust = overview.data?.trust;
  const volume = overview.data?.volume;
  const tierLabel = isVip(vipTier)
    ? VIP_TIER_LABEL[vipTier] ?? "VIP"
    : isVipPending(vipTier)
      ? "VIP (PENDING)"
      : "Standard";
  const complianceLabel =
    status === "approved"
      ? enhancedStatus === "approved"
        ? "Identity & Address Verified"
        : "KYC Verified"
      : KYC_LABEL[status] ?? "KYC Not Verified";

  return (
    <>
      {/* Identity card */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-start gap-4">
          <UserAvatar className="size-16" alt="Account avatar" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-lg font-bold tracking-tight">
              {profile?.displayName ?? "Trader"}
            </h1>
            <button
              onClick={() => profile?.uid && copy(profile.uid, "UID")}
              className="mt-0.5 inline-flex touch-manipulation items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              ID: {profile?.uid ?? "—"}
              <Copy className="size-3" />
            </button>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {status === "approved" ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500">
                  <BadgeCheck className="size-3" /> {complianceLabel}
                </span>
              ) : (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[status]}`}
                >
                  {KYC_LABEL[status] ?? status}
                </span>
              )}
              {isVip(vipTier) ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-300/25 to-amber-600/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                  <Crown className="size-3" /> {VIP_TIER_LABEL[vipTier] ?? "VIP"}
                </span>
              ) : isVipPending(vipTier) ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-500">
                  <Hourglass className="size-3" /> VIP (Pending)
                </span>
              ) : (
                <Link
                  to="/vip-upgrade"
                  className="inline-flex touch-manipulation items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground transition-colors hover:border-amber-400/50 hover:text-amber-500"
                >
                  Regular <ChevronRight className="size-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>



      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <header className="flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase text-muted-foreground">Account Health</h2>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="About account health" className="touch-manipulation text-muted-foreground transition-colors hover:text-foreground">
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                  Account Health reflects margin risk and liquidation safety — how much of your
                  available margin is committed to open leveraged exposure.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </header>
          <p className={`mt-3 text-lg font-semibold ${health ? HEALTH_TONE[health.status] : ""}`}>
            {health
              ? `${HEALTH_LABEL[health.status]} · ${(health.pct ?? 100).toFixed(1)}%${
                  health.hasExposure ? "" : " · No active margin exposure"
                }`
              : "—"}
          </p>
          <div className="mt-4 space-y-2 border-t border-border pt-4 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Margin utilization</span>
              <span className="font-semibold tabular-nums">
                {margin && margin.utilizationPct !== null
                  ? `${margin.utilizationPct.toFixed(1)}% used / ${(100 - margin.utilizationPct).toFixed(1)}% available`
                  : "0.0% used / 100.0% available"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Exposure risk</span>
              <span className={`font-semibold ${exposure?.risk ? RISK_TONE[exposure.risk] : ""}`}>
                {exposure?.risk ? RISK_LABEL[exposure.risk] : "None"}
              </span>
            </div>
            {exposure && exposure.leverageMax > 0 ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Leverage in use</span>
                <span className="font-semibold tabular-nums">{exposure.leverageMax}× maximum</span>
              </div>
            ) : null}
            {margin ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Open leveraged positions</span>
                <span className="font-semibold tabular-nums">{margin.openPositions}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Trader Trust Score</span>
              <span className="font-semibold tabular-nums">
                {trust ? `${trust.scorePct}%` : "—"}
              </span>
            </div>
            {trust ? (
              <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${trust.scorePct}%` }}
                />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground">Trading Tier & Volume</h2>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Trading tier</p>
              <p className="mt-1 text-lg font-semibold">
                {volume ? volume.tier.label : "—"}
                {tierLabel === "Standard" ? "" : ` · ${tierLabel}`}
              </p>
            </div>
            <Crown className="size-5 text-primary" />
          </div>
          <div className="mt-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">Monthly trading volume</p>
            <p className="mt-1 text-sm font-semibold tabular-nums">
              {volume
                ? `${usd(volume.monthUsdt)}${volume.nextTier ? ` / ${usd(volume.nextTier.thresholdUsdt)}` : ""}`
                : "—"}
            </p>
            {volume ? (
              <>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${volume.progressPct.toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {volume.nextTier
                    ? `${volume.progressPct.toFixed(1)}% progress to ${volume.nextTier.label}`
                    : "Highest tier reached"}
                  {" · "}
                  {volume.tradeCount} settled trade{volume.tradeCount === 1 ? "" : "s"} this month
                </p>
              </>
            ) : null}
          </div>
        </section>
      </div>

      {/* Support banner */}
      <section className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-secondary text-primary">
            <Headphones className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Velocity Support</p>
            <p className="text-xs text-muted-foreground">24/7 live assistance</p>
          </div>
        </div>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("velocity:open-chat", { detail: {} }))}
          className="relative touch-manipulation rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/80"
        >
          Get Support
          <SupportUnreadBadge />
        </button>
      </section>

      {/* Quick tiles */}
      <div className="grid grid-cols-2 gap-3">
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

      <button
        onClick={handleSignOut}
        className="mt-2 flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3.5 text-sm font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
      >
        <LogOut className="size-4" /> Log Out
      </button>
    </>
  );
}
