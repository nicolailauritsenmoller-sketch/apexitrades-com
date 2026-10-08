import { TreasuryWalletPanel } from "@/components/admin/TreasuryWalletPanel";
import { AccessBansPanel } from "@/components/admin/AccessBansPanel";
import { VolumeByClassPanel } from "@/components/admin/VolumeByClassPanel";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  Wallet2,
  Megaphone,
  Crown,
  Users,
  Landmark,
  Gauge,
  LayoutDashboard,
  BarChart3,
  Receipt,
  LifeBuoy,
  Inbox,
  Settings2,
  ScrollText,
  Fingerprint,
  KeySquare,
  CreditCard,
  Radio,
  Wrench,
  Star,
  Gift,
  IdCard,
  MessagesSquare,
  Trash2,
  BadgeCheck,
  ShieldAlert,
  Eye,
  CheckCheck,
  XCircle,
  Globe2,
} from "lucide-react";
import {
  MetricsBar,
  AnalyticsCharts,
  SystemActivity,
  TradeStatsPanel,
  TransactionsPanel,
  KycExpiry,
  type Analytics,
  type DeskFilter,
} from "@/components/admin/AdminAnalytics";
import { SupportDesk } from "@/components/admin/SupportDesk";
import { PlatformSettingsPanel } from "@/components/admin/PlatformSettingsPanel";
import { PlatformSettingsHub } from "@/components/admin/PlatformSettingsHub";
import { CertificatesPanel } from "@/components/admin/CertificatesPanel";
import { RolesPanel, ExportButton } from "@/components/admin/RolesCreditPanel";
import { TrustRiskPanel } from "@/components/admin/TrustRiskPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { AnnouncementsPanel } from "@/components/admin/AnnouncementsPanel";
import { ActiveUsersPanel } from "@/components/admin/ActiveUsersPanel";
import { TelemetryPanel } from "@/components/admin/TelemetryPanel";
import { TradeCorrections } from "@/components/admin/TradeCorrections";
import { RatingsPanel } from "@/components/admin/RatingsPanel";
import { ReferralsPanel } from "@/components/admin/ReferralsPanel";
import { UserSecurityPanel } from "@/components/admin/UserSecurityPanel";
import { AgentProfilePanel } from "@/components/admin/AgentProfilePanel";
import { VipDesk } from "@/components/admin/VipDesk";
import { getVipDesk } from "@/lib/vip.functions";
import { SecurityReportsPanel } from "@/components/admin/SecurityReportsPanel";
import { VerifiedBadge, UidTag } from "@/components/VerifiedBadge";
import { downloadCsv } from "@/lib/csv";
import { silenceChatAlerts } from "@/lib/alerts";
import { APPROVE_BTN, DANGER_BTN, OPS_ACCENTS, tabAccent } from "@/lib/admin-accents";
import { AdminShell } from "@/components/AdminShell";
import { OpsToggles } from "@/components/admin/OpsToggles";
import { MaintenanceModePanel } from "@/components/admin/MaintenanceModePanel";
import { AuthProvidersPanel } from "@/components/admin/AuthProvidersPanel";
import { UserWorkspaceDrawer } from "@/components/admin/UserWorkspaceDrawer";
import { RiskMonitor } from "@/components/admin/RiskMonitor";
import { PaymentGatewaysPanel } from "@/components/admin/PaymentGatewaysPanel";
import { EngineSpreadPanel } from "@/components/admin/EngineSpreadPanel";
import { AccountingPanel } from "@/components/admin/AccountingPanel";
import { KycReviewDrawer, TierBadge } from "@/components/admin/KycReviewDrawer";
import { PendingVipPanel } from "@/components/admin/PendingVipPanel";
import { VipMembershipsPage } from "@/components/admin/VipMembershipsPage";
import { supabase } from "@/integrations/supabase/client";
import { useHasSession } from "@/lib/use-session";

import { AssetIcon } from "@/lib/asset-icons";
import {
  adjustUserBalance,
  broadcastNotification,
  getAdminAnalytics,
  getAdminOverview,
  getKycDocumentUrls,
  getDepositProofUrl,
  getMyAccess,
  getSupportThreads,
  getUserWallets,
  deleteUserAccount,
  reviewDeposit,
  reviewKyc,
  reviewWithdrawal,
  setContractOutcomeMode,
  setUserOutcomeMode,
  unverifyKyc,
  getPlatformSettings,
  savePlatformSetting,
  upsertDepositAddress,
  deleteDepositAddress,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/sys-portal-x97")({
  head: () => ({
    meta: [
      { title: "Not found" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "This page is not available." },
      { property: "og:title", content: "Not found" },
      { property: "og:description", content: "This page is not available." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  // Role gating happens in the component (see `access` query below): the parent
  // `_authenticated` layout only resolves the Supabase session after mount, so a
  // beforeLoad role check races session hydration and bounces real admins home.


  component: AdminPage,
  errorComponent: () => <NotFoundScreen />,
  notFoundComponent: () => <NotFoundScreen />,
});

/** Non-admins never learn this path exists. */
function NotFoundScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">This page could not be found.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary">
          Return home
        </Link>
      </div>
    </div>
  );
}


const NAV: { section: string; items: { id: string; label: string; icon: any }[] }[] = [
  {
    section: "Live support",
    items: [
      { id: "support", label: "Live Chat", icon: MessagesSquare },
      { id: "vip", label: "Priority Support", icon: BadgeCheck },
      { id: "requests", label: "Submitted Requests", icon: Inbox },
      { id: "tickets", label: "Support Tickets", icon: LifeBuoy },
    ],
  },
  {
    section: "Overview",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard },
      { id: "analytics", label: "Analytics & volume", icon: BarChart3 },
      { id: "trades", label: "Trades & outcomes", icon: Gauge },
      { id: "corrections", label: "Trade corrections", icon: Wrench },
      { id: "active", label: "Active users now", icon: Radio },
      { id: "risk", label: "Risk & liquidation", icon: ShieldAlert },
    ],
  },
  {
    section: "People",
    items: [
      { id: "users", label: "Users & KYC", icon: Users },
      { id: "vipmembers", label: "VIP Memberships", icon: Crown },
      { id: "roles", label: "Roles & permissions", icon: KeySquare },
      { id: "restrictions", label: "User security & restrictions", icon: ShieldAlert },
      { id: "credit", label: "Trader Trust & Risk", icon: CreditCard },
    ],
  },
  {
    section: "Money",
    items: [
      { id: "deposits", label: "Deposit clearing", icon: Wallet2 },
      { id: "withdrawals", label: "Withdrawals", icon: Landmark },
      { id: "treasury", label: "Treasury wallet", icon: Wallet2 },
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "addresses", label: "Receiving addresses", icon: ShieldCheck },
      { id: "gateways", label: "Payment gateways", icon: CreditCard },
      { id: "accounting", label: "Accounting & revenue", icon: Receipt },
    ],
  },
  {
    section: "Engagement",
    items: [
      { id: "broadcast", label: "Broadcast", icon: Megaphone },
      { id: "community", label: "Community Desk", icon: Globe2 },
      { id: "referrals", label: "Referrals & rewards", icon: Gift },
      { id: "ratings", label: "Ratings & reviews", icon: Star },
      { id: "agent", label: "Agent persona", icon: IdCard },
    ],
  },
  {
    section: "System",
    items: [
      { id: "audit", label: "Audit logs", icon: ScrollText },
      { id: "security", label: "Security reports", icon: ShieldAlert },
      { id: "telemetry", label: "Security & activity", icon: Radio },
      { id: "authproviders", label: "Auth & identity", icon: Fingerprint },
      { id: "engine", label: "Engine & spreads", icon: Gauge },
      { id: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

/** Tabs a Support Agent may open (no money movement, no platform config). */
const AGENT_TABS = new Set([
  "support",
  "vip",
  "requests",
  "tickets",
  "ratings",
  "agent",
  "active",
  "overview",
]);

/** Tabs whose bodies need the finance-only admin overview payload. */
const DATA_TABS = new Set([
  "trades",
  "settings",
  "deposits",
  "withdrawals",
  "addresses",
  "gateways",
  "users",
  "broadcast",
]);


/** Tabs reserved for Super Admins only. */
const ADMIN_ONLY_TABS = new Set([
  "restrictions",
  "telemetry",
  "roles",
  "engine",
  "gateways",
  "settings",
  "authproviders",
  "audit",
  "security",
  "addresses",
]);

const TAB_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

type TabId = (typeof TAB_IDS)[number];

const STATUS_TONE: Record<string, string> = {
  pending: "text-ops-amber",
  approved: "text-ops-emerald",
  rejected: "text-ops-red",
};

const MODES = [
  { id: "normal", label: "Normal" },
  { id: "force_win", label: "Force win" },
  { id: "force_loss", label: "Force loss" },
] as const;

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">{title}</h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function ModeToggle({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (mode: (typeof MODES)[number]["id"]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5">
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          onClick={() => onChange(m.id)}
          className={`rounded px-2 py-1 text-[11px] transition-colors disabled:opacity-50 ${
            value === m.id
              ? m.id === "force_win"
                ? "bg-ops-emerald-bg text-ops-emerald"
                : m.id === "force_loss"
                  ? "bg-ops-red-bg text-ops-red"
                  : "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

function AdminPage() {
  const qc = useQueryClient();
  const hasSession = useHasSession();
  const [tab, setTab] = useState<TabId>("overview");
  const [filter, setFilter] = useState<DeskFilter>({});
  const [vipInspect, setVipInspect] = useState<string | null>(null);
  const statusFilter = filter.status ?? null;
  const go = (next: string, nextFilter?: DeskFilter) => {
    setTab(next as TabId);
    setFilter(nextFilter ?? {});
  };


  const fetchAccess = useServerFn(getMyAccess);
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchAnalytics = useServerFn(getAdminAnalytics);

  const access = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    enabled: hasSession === true,
    retry: false,
  });
  const isAdmin = access.data?.isAdmin === true;
  const canFinance = access.data?.canFinance === true;
  const isStaff = access.data?.isStaff === true;

  /** Navigation filtered by the signed-in staff member's role. */
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (isAdmin) return true;
      if (ADMIN_ONLY_TABS.has(i.id)) return false;
      if (canFinance) return true;
      return AGENT_TABS.has(i.id);
    }),
  })).filter((g) => g.items.length > 0);

  // Unread live-chat counter for the sidebar badge.
  const fetchThreads = useServerFn(getSupportThreads);
  const threads = useQuery({
    queryKey: ["desk-unread"],
    queryFn: () => fetchThreads(),
    enabled: isStaff,
    refetchInterval: 10_000,
  });
  const unreadChats = (threads.data ?? []).reduce(
    (a: number, t: any) => a + Number(t.unread ?? 0),
    0,
  );

  // VIP specialist inbox unread counter (shares the VIP desk query cache).
  const fetchVipDesk = useServerFn(getVipDesk);
  const vipDesk = useQuery({
    queryKey: ["vip-desk"],
    queryFn: () => fetchVipDesk(),
    enabled: isStaff,
    refetchInterval: 15_000,
  });
  const unreadVip = ((vipDesk.data as any)?.threads ?? []).reduce(
    (a: number, t: any) => a + Number(t.unread ?? 0),
    0,
  );

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-vip-unread")
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["vip-desk"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  useEffect(() => {
    const bump = () => qc.invalidateQueries({ queryKey: ["desk-unread"] });
    window.addEventListener("desk:chat-inbound", bump);
    window.addEventListener("desk:chat-focus", bump);
    return () => {
      window.removeEventListener("desk:chat-inbound", bump);
      window.removeEventListener("desk:chat-focus", bump);
    };
  }, [qc]);

  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview(),
    enabled: canFinance,
    refetchInterval: 20_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAnalytics(),
    enabled: canFinance,
    refetchInterval: 30_000,
  });

  // Live pending counters - refresh instantly on any queue change.
  useEffect(() => {
    if (!isAdmin) return;
    const bump = () => {
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    };
    const channel = supabase.channel("admin-pending-queues");
    for (const table of ["deposits", "withdrawals", "kyc_submissions", "support_tickets"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  const pendingCounts = {
    deposits: Number((analyticsQuery.data as Analytics | undefined)?.metrics?.pendingDeposits ?? 0),
    withdrawals: Number(
      (analyticsQuery.data as Analytics | undefined)?.metrics?.pendingWithdrawals ?? 0,
    ),
    users: Number((analyticsQuery.data as Analytics | undefined)?.metrics?.pendingKyc ?? 0),
    tickets: Number((analyticsQuery.data as Analytics | undefined)?.metrics?.openTickets ?? 0),
  } as Record<string, number>;


  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
    qc.invalidateQueries({ queryKey: ["admin-analytics"] });
  };

  if (access.isLoading) {
    return (
      <AdminShell>
        <p className="p-8 text-sm text-muted-foreground">Checking access…</p>
      </AdminShell>
    );
  }

  if (access.isError) {
    return (
      <AdminShell>
        <div className="p-8 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Could not verify your access.</p>
          <p className="mt-1">The permission check failed. Try again in a moment.</p>
          <button
            onClick={() => void access.refetch()}
            className="mt-4 touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      </AdminShell>
    );
  }

  if (!isStaff) return <NotFoundScreen />;
  const allowedTabs = new Set(nav.flatMap((g) => g.items.map((i) => i.id)));
  if (!allowedTabs.has(tab)) return <NotFoundScreen />;

  const data = overview.data;
  const analytics = analyticsQuery.data as Analytics | undefined;

  const activeLabel =
    nav.flatMap((g) => g.items).find((i) => i.id === tab)?.label ?? "Dashboard";
  const activeSection =
    nav.find((g) => g.items.some((i) => i.id === tab))?.section ?? "Overview";
  const USER_FILTER_LABEL: Record<string, string> = {
    today: "Registered in last 24h",
    week: "Registered in last 7 days",
    month: "Registered in last 30 days",
    referred: "Referred users only",
  };
  const filterLabel = filter.users
    ? USER_FILTER_LABEL[filter.users]
    : filter.status
      ? `Status: ${filter.status}`
      : null;


  return (
    <AdminShell>
      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Vertical backend sidebar */}
        <aside className="shrink-0 lg:w-60">
          <div className="rounded-lg border border-border bg-card p-2 lg:sticky lg:top-20">
            <div className="hidden px-2 py-2 lg:block">
              <p className="font-display text-sm font-bold tracking-tight">Desk management</p>
              <p className="text-[11px] text-muted-foreground">Operations backend</p>
            </div>
            <nav className="flex gap-1 overflow-x-auto lg:block lg:space-y-3 lg:overflow-visible">
              {nav.map((group) => (
                <div key={group.section} className="shrink-0 lg:block">
                  <p className="hidden px-2 pb-1 pt-2 text-[10px] uppercase tracking-widest text-muted-foreground lg:block">
                    {group.section}
                  </p>
                  <div className="flex gap-1 lg:block lg:space-y-0.5">
                    {group.items.map(({ id, label, icon: Icon }) => {
                      const isChat = id === "support";
                      const pending =
                        isChat ? unreadChats : id === "vip" ? unreadVip : (pendingCounts[id] ?? 0);
                      const alerting = pending > 0;
                      const accentTheme = OPS_ACCENTS[tabAccent(id)];
                      return (
                        <button
                          key={id}
                          onClick={() => {
                             if (id === "community") {
                               window.location.assign("/admin/community");
                               return;
                             }
                            go(id, alerting && !isChat ? { status: "pending" } : undefined);
                            if (isChat) silenceChatAlerts();
                          }}
                          className={`flex w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-md border-l-2 px-3 py-2 text-left text-sm transition-colors ${
                            tab === id
                              ? `${accentTheme.tab} border-l-current font-medium`
                              : "border-l-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
                          } ${
                            alerting
                              ? isChat
                                ? "animate-pulse border border-ops-red/60 text-foreground ring-2 ring-ops-red/30"
                                : "border border-ops-red/70 text-foreground"
                              : ""
                          }`}
                        >
                          <Icon
                            className={`size-4 shrink-0 ${
                              alerting && !isChat ? "text-ops-red" : accentTheme.text
                            }`}
                          />
                          <span className="truncate">{label}</span>
                          {pending > 0 && (
                            <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-ops-red px-1.5 py-0.5 text-[10px] font-bold leading-none text-background">
                              {pending}
                            </span>
                          )}
                        </button>

                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="sticky top-16 z-20 -mx-1 mb-2 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/70 bg-background/95 px-4 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
            <div className="min-w-0 flex-1 basis-56">
              <nav className="flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
                <button onClick={() => go("overview")} className="hover:text-foreground">
                  Desk
                </button>
                <span>/</span>
                <span className="text-foreground">{activeSection}</span>
                <span>/</span>
                <span className="text-primary">{activeLabel}</span>
              </nav>
              <h1 className="mt-1 break-words font-display text-lg font-bold leading-tight tracking-tight sm:text-xl">
                {activeLabel}
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {filterLabel && (
                <button
                  onClick={() => setFilter({})}
                  className="flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {filterLabel} ✕
                </button>
              )}
              <button
                onClick={refresh}
                className="rounded-xl border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                Refresh
              </button>
            </div>
          </div>



          {tab === "corrections" && <TradeCorrections />}
          {tab === "risk" && <RiskMonitor />}
          {tab === "engine" && <EngineSpreadPanel />}
          {tab === "accounting" && <AccountingPanel />}
          {tab === "active" && <ActiveUsersPanel />}
          {tab === "telemetry" && <TelemetryPanel />}
          {tab === "referrals" && <ReferralsPanel />}
          {tab === "ratings" && <RatingsPanel />}
          {tab === "agent" && <AgentProfilePanel />}
          {tab === "vip" && <VipDesk />}
          {tab === "vipmembers" && (
            <>
              <VipMembershipsPage onOpen={(id) => setVipInspect(id)} />
              {vipInspect && (
                <UserWorkspaceDrawer userId={vipInspect} onClose={() => setVipInspect(null)} />
              )}
            </>
          )}
          {tab === "security" && <SecurityReportsPanel />}
          {tab === "roles" && <RolesPanel />}
          {tab === "treasury" && <TreasuryWalletPanel />}
          {tab === "restrictions" && (
            <div className="space-y-4">
              <UserSecurityPanel />
              <AccessBansPanel />
            </div>
          )}
          {tab === "credit" && <TrustRiskPanel />}
          {tab === "audit" && <AuditLogPanel />}
          {tab === "authproviders" && <AuthProvidersPanel />}

          {DATA_TABS.has(tab) && overview.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading console…</p>
          ) : DATA_TABS.has(tab) && !data ? (
            <p className="text-sm text-ops-red">{(overview.error as Error)?.message ?? "No data."}</p>
          ) : (
            <>
              {tab === "overview" && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      go("support");
                      silenceChatAlerts();
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${
                      unreadChats > 0
                        ? "border-ops-red/40 bg-ops-red-bg"
                        : "border-border bg-card"
                    }`}
                  >
                    <MessagesSquare className={`size-5 ${unreadChats > 0 ? "text-ops-red" : "text-muted-foreground"}`} />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold tracking-tight">Live Chat</p>
                      <p className="text-xs text-muted-foreground">
                        {unreadChats > 0
                          ? `${unreadChats} unread user message${unreadChats === 1 ? "" : "s"} waiting`
                          : "No unread messages - inbox clear"}
                      </p>
                    </div>
                    {unreadChats > 0 && (
                      <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-ops-red px-2 py-1 text-xs font-bold leading-none text-background">
                        {unreadChats}
                      </span>
                    )}
                  </button>
                  <Card title="Pending VIP requests">
                    <PendingVipPanel onOpen={(id) => setVipInspect(id)} />
                  </Card>
                  {vipInspect && (
                    <UserWorkspaceDrawer userId={vipInspect} onClose={() => setVipInspect(null)} />
                  )}
                  {analytics ? (
                    <>
                      <button
                        type="button"
                        onClick={() => go("active")}
                        className="block w-full text-left transition-transform hover:-translate-y-0.5"
                      >
                        <ActiveUsersPanel compact />
                      </button>
                      <MetricsBar a={analytics} onOpen={go} />
                      <VolumeByClassPanel />
                    <AnalyticsCharts a={analytics} />
                      <KycExpiry a={analytics} />
                      <SystemActivity a={analytics} />
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Loading metrics…</p>
                  )}
                </div>
              )}
              {tab === "analytics" &&
                (analytics ? (
                  <div className="space-y-4">
                    <AnalyticsCharts a={analytics} />
                    <SystemActivity a={analytics} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading analytics…</p>
                ))}
              {tab === "trades" && data && (
                <div className="space-y-4">
                  {analytics && <TradeStatsPanel a={analytics} />}
                  <OutcomesTab
                    contracts={data.openContracts}
                    profiles={data.profiles}
                    onDone={refresh}
                  />
                  <TradeCorrections />
                </div>
              )}
              {tab === "transactions" &&
                (analytics ? (
                  <TransactionsPanel a={analytics} />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading ledger…</p>
                ))}
              {tab === "support" && <SupportDesk />}
              {tab === "requests" && <SupportDesk initialView="requests" />}
              {tab === "tickets" && <SupportDesk initialView="tickets" />}
              {tab === "settings" && data && (
                <div className="space-y-4">
                  <MaintenanceModePanel />
                  <OpsToggles />
                  <PlatformSettingsHub />
                  <PlatformSettingsPanel />
                  <CertificatesPanel />
                  <AddressesTab rows={data.addresses} onDone={refresh} />
                  <OutcomesTab
                    contracts={data.openContracts}
                    profiles={data.profiles}
                    onDone={refresh}
                  />
                </div>
              )}
              {tab === "deposits" && data && (
                <DepositsTab rows={data.deposits} onDone={refresh} statusFilter={statusFilter} />
              )}
              {tab === "withdrawals" && data && (
                <WithdrawalsTab
                  rows={data.withdrawals}
                  onDone={refresh}
                  statusFilter={statusFilter}
                />
              )}
              {tab === "addresses" && data && <AddressesTab rows={data.addresses} onDone={refresh} />}
              {tab === "gateways" && data && (
                <PaymentGatewaysPanel addresses={data.addresses as any} onDone={refresh} />
              )}
              {tab === "users" && data && (
                <UsersTab
                  profiles={data.profiles}
                  kyc={data.kyc}
                  onDone={refresh}
                  statusFilter={statusFilter}
                  userFilter={filter.users ?? null}
                />
              )}
              {tab === "broadcast" && data && (
                <div className="space-y-4">
                  <AnnouncementsPanel />
                  <BroadcastTab profiles={data.profiles} />
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </AdminShell>
  );
}

function useReview(fn: typeof reviewDeposit, onDone: () => void, label: string) {
  const call = useServerFn(fn);
  return useMutation({
    mutationFn: (input: { id: string; action: "approve" | "reject"; note?: string }) =>
      call({ data: input }),
    onSuccess: (_r, v) => {
      toast.success(`${label} ${v.action === "approve" ? "approved" : "rejected"}.`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

function ReviewButtons({
  onAction,
  pending,
}: {
  onAction: (action: "approve" | "reject") => void;
  pending: boolean;
}) {
  return (
    <div className="flex gap-2">
      <button
        disabled={pending}
        onClick={() => onAction("approve")}
        className={APPROVE_BTN}
      >
        Approve
      </button>
      <button
        disabled={pending}
        onClick={() => onAction("reject")}
        className={DANGER_BTN}
      >
        Reject
      </button>
    </div>
  );
}

/** Thumbnail + lightbox for a deposit's uploaded proof of payment. */
function DepositProof({ id }: { id: string }) {
  const fetchUrl = useServerFn(getDepositProofUrl);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const proof = useQuery({
    queryKey: ["deposit-proof", id],
    queryFn: () => fetchUrl({ data: { id } }),
    staleTime: 300_000,
  });
  const url = proof.data?.url ?? null;
  if (!url) {
    return <p className="mt-2 text-[11px] text-muted-foreground">Loading payment proof…</p>;
  }
  if (!shown) {
    return (
      <button
        onClick={() => setShown(true)}
        className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        View proof receipt
      </button>
    );
  }
  return (
    <div className="mt-2">
      <button
        onClick={() => setShown(false)}
        className="mb-2 block rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        Hide receipt
      </button>
      <button onClick={() => setOpen(true)} className="block">
        <img
          src={url}
          alt="Proof of payment"
          className="h-24 w-auto rounded-md border border-border object-cover transition-opacity hover:opacity-80"
        />
      </button>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        Proof of payment - click to enlarge
      </p>
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-6"
        >
          <img src={url} alt="Proof of payment full size" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}

/** Shared multi-select toolbar for approval queues. */
function BulkBar({
  total,
  selected,
  allChecked,
  onToggleAll,
  onApprove,
  onReject,
  pending,
}: {
  total: number;
  selected: number;
  allChecked: boolean;
  onToggleAll: () => void;
  onApprove: () => void;
  onReject: () => void;
  pending: boolean;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2">
      <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={onToggleAll}
          className="size-3.5 accent-[hsl(var(--primary))]"
        />
        Select all pending ({total})
      </label>
      <span className="text-[11px] text-muted-foreground">{selected} selected</span>
      <div className="ml-auto flex gap-2">
        <button
          disabled={pending || selected === 0}
          onClick={onApprove}
          className={`flex items-center gap-1.5 ${APPROVE_BTN}`}
        >
          <CheckCheck className="size-3.5" /> Bulk approve
        </button>
        <button
          disabled={pending || selected === 0}
          onClick={onReject}
          className={`flex items-center gap-1.5 ${DANGER_BTN}`}
        >
          <XCircle className="size-3.5" /> Bulk reject
        </button>
      </div>
    </div>
  );
}

function useBulkSelection() {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return { checked, setChecked, toggle };
}

function DepositsTab({
  rows: allRows,
  onDone,
  statusFilter,
}: {
  rows: any[];
  onDone: () => void;
  statusFilter?: string | null;
}) {
  const review = useReview(reviewDeposit, onDone, "Deposit");
  const [note, setNote] = useState<Record<string, string>>({});
  const rows = statusFilter ? allRows.filter((r) => r.status === statusFilter) : allRows;
  const { checked, setChecked, toggle } = useBulkSelection();
  const pendingRows = rows.filter((r) => r.status === "pending");
  const allChecked = pendingRows.length > 0 && pendingRows.every((r) => checked.has(r.id));
  const runBulk = (action: "approve" | "reject") => {
    for (const id of checked) review.mutate({ id, action });
    setChecked(new Set());
  };


  return (
    <Card
      title={`Deposit submissions (${rows.length})`}
      action={
        <ExportButton
          label="Export CSV"
          onClick={() =>
            downloadCsv(
              `deposits-${new Date().toISOString().slice(0, 10)}`,
              rows.map((d) => ({
                created_at: d.created_at,
                user_id: d.user_id,
                coin: d.coin,
                network: d.network,
                amount: d.amount,
                status: d.status,
                tx_hash: d.tx_hash ?? "",
              })),
            )
          }
        />
      }
    >
      {pendingRows.length > 0 && (
        <BulkBar
          total={pendingRows.length}
          selected={checked.size}
          allChecked={allChecked}
          onToggleAll={() =>
            setChecked(allChecked ? new Set() : new Set(pendingRows.map((r) => r.id)))
          }
          onApprove={() => runBulk("approve")}
          onReject={() => runBulk("reject")}
          pending={review.isPending}
        />
      )}
      {rows.length === 0 ? (
        <Empty label="No deposits submitted yet." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id} className="rounded-xl border border-border/70 bg-card/40 p-3 transition-colors hover:border-primary/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {d.status === "pending" && (
                    <input
                      type="checkbox"
                      aria-label="Select deposit"
                      checked={checked.has(d.id)}
                      onChange={() => toggle(d.id)}
                      className="size-4 accent-[hsl(var(--primary))]"
                    />
                  )}
                  <AssetIcon symbol={d.coin} className="size-7" />
                  <div>
                    <p className="text-sm font-semibold">
                      {Number(d.amount)} {d.coin}{" "}
                      <span className="text-xs text-muted-foreground">({d.network})</span>
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      user {String(d.user_id).slice(0, 8)}… ·{" "}
                      {new Date(d.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`text-xs uppercase ${STATUS_TONE[d.status] ?? ""}`}>
                  {d.status}
                </span>
              </div>

              {d.tx_hash && (
                <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                  tx:{" "}
                  {explorerUrl(d.network, d.tx_hash) ? (
                    <a href={explorerUrl(d.network, d.tx_hash)!} target="_blank" rel="noreferrer" className="text-primary underline">
                      {d.tx_hash}
                    </a>
                  ) : (
                    d.tx_hash
                  )}
                </p>
              )}
              {d.receipt_path && <DepositProof id={d.id} />}
              {d.admin_note && (
                <p className="mt-1 text-[11px] text-muted-foreground">note: {d.admin_note}</p>
              )}

              {d.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={note[d.id] ?? ""}
                    onChange={(e) => setNote((p) => ({ ...p, [d.id]: e.target.value }))}
                    placeholder="Optional note"
                    className="h-8 min-w-[180px] flex-1 rounded-md border border-border bg-background px-2 text-xs"
                  />
                  <ReviewButtons
                    pending={review.isPending}
                    onAction={(action) =>
                      review.mutate({ id: d.id, action, note: note[d.id] || undefined })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function WithdrawalsTab({
  rows: allRows,
  onDone,
  statusFilter,
}: {
  rows: any[];
  onDone: () => void;
  statusFilter?: string | null;
}) {
  const review = useReview(reviewWithdrawal, onDone, "Withdrawal");
  const [note, setNote] = useState<Record<string, string>>({});
  const rows = statusFilter ? allRows.filter((r) => r.status === statusFilter) : allRows;
  const { checked, setChecked, toggle } = useBulkSelection();
  const pendingRows = rows.filter((r) => r.status === "pending");
  const allChecked = pendingRows.length > 0 && pendingRows.every((r) => checked.has(r.id));
  const runBulk = (action: "approve" | "reject") => {
    for (const id of checked) review.mutate({ id, action });
    setChecked(new Set());
  };


  return (
    <Card
      title={`Withdrawal requests (${rows.length})`}
      action={
        <ExportButton
          label="Export CSV"
          onClick={() =>
            downloadCsv(
              `withdrawals-${new Date().toISOString().slice(0, 10)}`,
              rows.map((w) => ({
                created_at: w.created_at,
                user_id: w.user_id,
                coin: w.coin,
                network: w.network,
                amount: w.amount,
                destination: w.destination_address,
                status: w.status,
              })),
            )
          }
        />
      }
    >
      {pendingRows.length > 0 && (
        <BulkBar
          total={pendingRows.length}
          selected={checked.size}
          allChecked={allChecked}
          onToggleAll={() =>
            setChecked(allChecked ? new Set() : new Set(pendingRows.map((r) => r.id)))
          }
          onApprove={() => runBulk("approve")}
          onReject={() => runBulk("reject")}
          pending={review.isPending}
        />
      )}
      {rows.length === 0 ? (
        <Empty label="No withdrawal requests yet." />
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => (
            <li key={w.id} className="rounded-xl border border-border/70 bg-card/40 p-3 transition-colors hover:border-primary/40">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {w.status === "pending" && (
                    <input
                      type="checkbox"
                      aria-label="Select withdrawal"
                      checked={checked.has(w.id)}
                      onChange={() => toggle(w.id)}
                      className="size-4 accent-[hsl(var(--primary))]"
                    />
                  )}
                  <AssetIcon symbol={w.coin} className="size-7" />
                  <div>
                    <p className="text-sm font-semibold">
                      {Number(w.amount)} {w.coin}{" "}
                      <span className="text-xs text-muted-foreground">({w.network})</span>
                    </p>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">
                      → {w.destination_address}{" "}
                      {addressValid(w.network, w.destination_address) ? (
                        <span className="ml-1 rounded bg-ops-emerald-bg px-1.5 py-0.5 text-[9px] font-bold uppercase text-ops-emerald">Format valid</span>
                      ) : (
                        <span className="ml-1 rounded bg-bear/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ops-red">Check address</span>
                      )}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      user {String(w.user_id).slice(0, 8)}… ·{" "}
                      {new Date(w.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
                <span className={`text-xs uppercase ${STATUS_TONE[w.status] ?? ""}`}>
                  {w.status}
                </span>
              </div>

              {w.status === "pending" && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    value={note[w.id] ?? ""}
                    onChange={(e) => setNote((p) => ({ ...p, [w.id]: e.target.value }))}
                    placeholder="Optional note"
                    className="h-8 min-w-[180px] flex-1 rounded-md border border-border bg-background px-2 text-xs"
                  />
                  <ReviewButtons
                    pending={review.isPending}
                    onAction={(action) =>
                      review.mutate({ id: w.id, action, note: note[w.id] || undefined })
                    }
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function qrUrl(text: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(text)}`;
}

function AddressesTab({ rows, onDone }: { rows: any[]; onDone: () => void }) {
  const save = useServerFn(upsertDepositAddress);
  const [draft, setDraft] = useState({
    coin: "USDT",
    network: "TRC20",
    address: "",
    memo: "",
    active: true,
  });

  const mutation = useMutation({
    mutationFn: (input: any) => save({ data: input }),
    onSuccess: () => {
      toast.success("Deposit address saved.");
      setDraft({ coin: "USDT", network: "TRC20", address: "", memo: "", active: true });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <Card title={`Receiving addresses (${rows.length})`}>
        {rows.length === 0 ? (
          <Empty label="No addresses configured." />
        ) : (
          <ul className="space-y-3">
            {rows.map((a) => (
              <AddressRow key={a.id} row={a} onDone={onDone} />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Add address">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.coin}
              onChange={(e) => setDraft((d) => ({ ...d, coin: e.target.value }))}
              placeholder="Coin (USDT)"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
            <input
              value={draft.network}
              onChange={(e) => setDraft((d) => ({ ...d, network: e.target.value }))}
              placeholder="Network (TRC20)"
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
          </div>
          <input
            value={draft.address}
            onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            placeholder="Wallet address"
            className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
          />
          <input
            value={draft.memo}
            onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
            placeholder="Memo / tag (optional)"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
          <button
            disabled={mutation.isPending || draft.address.trim().length < 4}
            onClick={() =>
              mutation.mutate({
                coin: draft.coin.trim(),
                network: draft.network.trim(),
                address: draft.address.trim(),
                memo: draft.memo.trim() || undefined,
                active: true,
              })
            }
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save address
          </button>
        </div>
      </Card>
    </div>
  );
}

function AddressRow({ row, onDone }: { row: any; onDone: () => void }) {
  const save = useServerFn(upsertDepositAddress);
  const remove = useServerFn(deleteDepositAddress);
  const [address, setAddress] = useState(row.address as string);

  const mutation = useMutation({
    mutationFn: (input: any) => save({ data: input }),
    onSuccess: () => {
      toast.success("Address updated.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletion = useMutation({
    mutationFn: () => remove({ data: { id: row.id as string } }),
    onSuccess: () => {
      toast.success("Address deleted.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const base = {
    id: row.id,
    coin: row.coin,
    network: row.network,
    memo: row.memo ?? undefined,
  };

  return (
    <li className="flex flex-wrap items-start gap-4 rounded-md border border-border p-3">
      <img
        src={qrUrl(row.address)}
        alt={`${row.coin} ${row.network} deposit QR code`}
        width={100}
        height={100}
        loading="lazy"
        className="rounded bg-white p-1"
      />
      <div className="min-w-[220px] flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <AssetIcon symbol={row.coin} className="size-6" />
          <span className="text-sm font-semibold">
            {row.coin} · {row.network}
          </span>
          <span
            className={`ml-auto text-[11px] uppercase ${row.active ? "text-ops-emerald" : "text-muted-foreground"}`}
          >
            {row.active ? "active" : "disabled"}
          </span>
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 font-mono text-xs"
        />
        <div className="flex gap-2">
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ ...base, address, active: row.active })}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            Save
          </button>
          <button
            disabled={mutation.isPending}
            onClick={() => mutation.mutate({ ...base, address, active: !row.active })}
            className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {row.active ? "Disable" : "Enable"}
          </button>
          <button
            disabled={deletion.isPending}
            onClick={() => {
              if (confirm(`Delete the ${row.coin} ${row.network} address?`)) deletion.mutate();
            }}
            className="rounded-md border border-ops-red/25 px-3 py-1.5 text-xs font-semibold text-ops-red hover:bg-ops-red-bg disabled:opacity-50"
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

function OutcomesTab({
  contracts,
  profiles,
  onDone,
}: {
  contracts: any[];
  profiles: any[];
  onDone: () => void;
}) {
  const setUser = useServerFn(setUserOutcomeMode);
  const setContract = useServerFn(setContractOutcomeMode);
  const readSettings = useServerFn(getPlatformSettings);
  const writeSetting = useServerFn(savePlatformSetting);
  const [query, setQuery] = useState("");

  const settings = useQuery({
    queryKey: ["platform-settings", "trading"],
    queryFn: () => readSettings({ data: { keys: ["trading"] } }),
  });
  const globalMode = ((settings.data as any)?.trading?.defaultOutcome ?? "normal") as
    | "normal"
    | "force_win"
    | "force_loss";

  const globalMutation = useMutation({
    mutationFn: (mode: string) =>
      writeSetting({
        data: {
          key: "trading",
          value: { ...(((settings.data as any)?.trading ?? {}) as object), defaultOutcome: mode },
        },
      }),
    onSuccess: () => {
      toast.success("Global trade outcome updated.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const q = query.trim().toLowerCase();
  const filteredProfiles = q
    ? profiles.filter(
        (p) =>
          String(p.display_name ?? "").toLowerCase().includes(q) ||
          String(p.uid ?? "").toLowerCase().includes(q) ||
          String(p.id).toLowerCase().includes(q),
      )
    : profiles;

  const userMutation = useMutation({
    mutationFn: (input: any) => setUser({ data: input }),
    onSuccess: () => {
      toast.success("Account outcome mode updated.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const contractMutation = useMutation({
    mutationFn: (input: any) => setContract({ data: input }),
    onSuccess: () => {
      toast.success("Contract outcome updated.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card title="Global default trade outcome">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-muted-foreground">
            Applied to every settlement unless a per-user or per-contract override exists.
          </p>
          <div className="ml-auto">
            <ModeToggle
              value={globalMode}
              disabled={globalMutation.isPending}
              onChange={(mode) => globalMutation.mutate(mode)}
            />
          </div>
        </div>
      </Card>

      <Card title={`Open contracts (${contracts.length})`}>
        {contracts.length === 0 ? (
          <Empty label="No open contracts right now." />
        ) : (
          <ul className="space-y-2">
            {contracts.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
              >
                <AssetIcon symbol={c.display_symbol} className="size-6" />
                <div className="min-w-[160px]">
                  <p className="text-sm font-semibold">
                    {c.display_symbol}{" "}
                    <span className={c.direction === "up" ? "text-ops-emerald" : "text-ops-red"}>
                      {String(c.direction).toUpperCase()}
                    </span>
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {Number(c.stake)} {c.currency} · {c.duration_seconds}s · expires{" "}
                    {new Date(c.expires_at).toLocaleTimeString()}
                  </p>
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  user {String(c.user_id).slice(0, 8)}…
                </p>
                <div className="ml-auto">
                  <ModeToggle
                    value={c.outcome_override}
                    disabled={contractMutation.isPending}
                    onChange={(mode) => contractMutation.mutate({ contractId: c.id, mode })}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Account-level outcome control (${filteredProfiles.length})`}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by UID, name or account id"
          className="mb-3 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <ul className="space-y-2">
          {filteredProfiles.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-3 rounded-md border border-border p-3"
            >
              <div className="min-w-[180px]">
                <p className="text-sm font-semibold">{p.display_name}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {p.uid ? `#${p.uid} · ` : ""}
                  {String(p.id).slice(0, 8)}…
                </p>
              </div>
              <div className="ml-auto">
                <ModeToggle
                  value={p.outcome_mode}
                  disabled={userMutation.isPending}
                  onChange={(mode) => userMutation.mutate({ userId: p.id, mode })}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function UsersTab({
  profiles: allProfiles,
  kyc: kycAll,
  onDone,
  statusFilter,
  userFilter,
}: {
  profiles: any[];
  kyc: any[];
  onDone: () => void;
  statusFilter?: string | null;
  userFilter?: "today" | "week" | "month" | "referred" | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [inspect, setInspect] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const since = (days: number) => Date.now() - days * 86_400_000;
  const profiles = allProfiles.filter((p) => {
    if (userFilter === "today") return new Date(p.created_at).getTime() >= since(1);
    if (userFilter === "week") return new Date(p.created_at).getTime() >= since(7);
    if (userFilter === "month") return new Date(p.created_at).getTime() >= since(30);
    if (userFilter === "referred") return Boolean(p.referred_by);
    return true;
  });

  // Level 2 submissions awaiting review must surface in the pending queue even
  // when the applicant's Level 1 record is already approved.
  const kyc = statusFilter
    ? kycAll.filter(
        (k) => k.status === statusFilter || (statusFilter === "pending" && k.level2_status === "pending"),
      )
    : kycAll;
  const verifiedIds = new Set(
    kycAll.filter((k) => k.status === "approved").map((k) => k.user_id),
  );

  const heading =
    userFilter === "today"
      ? "New users today"
      : userFilter === "week"
        ? "Weekly sign-ups"
        : userFilter === "month"
          ? "Monthly sign-ups"
          : userFilter === "referred"
            ? "Referred users"
            : "Registered users";

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = profiles.length > 0 && profiles.every((p) => checked.has(p.id));

  return (
    <div className="space-y-4">
      <Card
        title={`${heading} (${profiles.length})`}
        action={
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={allChecked}
                onChange={() =>
                  setChecked(allChecked ? new Set() : new Set(profiles.map((p) => p.id)))
                }
                className="size-3.5 accent-[hsl(var(--primary))]"
              />
              Select all
            </label>
            <ExportButton
              label={checked.size > 0 ? `Export ${checked.size}` : "Export CSV"}
              onClick={() => {
                const rows = (checked.size > 0
                  ? profiles.filter((p) => checked.has(p.id))
                  : profiles
                ).map((p) => ({
                  created_at: p.created_at,
                  user_id: p.id,
                  uid: p.uid ?? "",
                  display_name: p.display_name,
                  base_currency: p.base_currency,
                  credit_score: p.credit_score,
                  referred_by: p.referred_by ?? "",
                  kyc_verified: verifiedIds.has(p.id),
                }));
                if (!downloadCsv(`users-${new Date().toISOString().slice(0, 10)}`, rows))
                  toast.error("Nothing to export.");
              }}
            />
          </div>
        }
      >
        {profiles.length === 0 ? (
          <Empty label="No users match this filter." />
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li
                key={p.id}
                className="rounded-xl border border-border/70 bg-card/40 p-3 transition-colors hover:border-primary/40"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="checkbox"
                    aria-label={`Select ${p.display_name}`}
                    checked={checked.has(p.id)}
                    onChange={() => toggle(p.id)}
                    className="size-4 accent-[hsl(var(--primary))]"
                  />
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {p.display_name}
                      {verifiedIds.has(p.id) && <VerifiedBadge />}
                      {p.referred_by && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          referred
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      <UidTag uid={p.uid} /> · base {p.base_currency} · joined{" "}
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setInspect(p.id)}
                    className="ml-auto flex items-center gap-1.5 rounded-xl border border-primary/40 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                  >
                    <Eye className="size-3.5" /> Inspect workspace
                  </button>
                  <button
                    onClick={() => setSelected(selected === p.id ? null : p.id)}
                    className="rounded-xl border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {selected === p.id ? "Hide balances" : "Manage balances"}
                  </button>
                  <DeleteUserButton userId={p.id} name={p.display_name} onDone={onDone} />
                </div>
                {selected === p.id && <BalanceEditor userId={p.id} onDone={onDone} />}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <KycQueue kyc={kyc} onDone={onDone} />

      {inspect && <UserWorkspaceDrawer userId={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}


/** Permanent cascade removal of a user and all of their data. */
function DeleteUserButton({
  userId,
  name,
  onDone,
}: {
  userId: string;
  name: string;
  onDone: () => void;
}) {
  const call = useServerFn(deleteUserAccount);
  const [confirming, setConfirming] = useState(false);
  const mutation = useMutation({
    mutationFn: () => call({ data: { userId } }),
    onSuccess: () => {
      toast.success(`${name} and all associated records were permanently deleted.`);
      setConfirming(false);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-ops-red">Permanently delete everything?</span>
        <button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-md bg-bear px-3 py-1.5 text-xs font-semibold text-ops-red-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-md border border-ops-red/25 px-3 py-1.5 text-xs font-semibold text-ops-red hover:bg-ops-red-bg"
    >
      <Trash2 className="size-3.5" /> Delete user
    </button>
  );
}

function BalanceEditor({ userId, onDone }: { userId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const fetchWallets = useServerFn(getUserWallets);
  const adjust = useServerFn(adjustUserBalance);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const wallets = useQuery({
    queryKey: ["admin-wallets", userId],
    queryFn: () => fetchWallets({ data: { userId } }),
  });

  const mutation = useMutation({
    mutationFn: (input: any) => adjust({ data: input }),
    onSuccess: () => {
      toast.success("Balance updated.");
      qc.invalidateQueries({ queryKey: ["admin-wallets", userId] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (wallets.isLoading) {
    return <p className="mt-3 text-xs text-muted-foreground">Loading balances…</p>;
  }

  return (
    <ul className="mt-3 space-y-2 border-t border-border pt-3">
      {(wallets.data ?? []).map((w: any) => (
        <li key={w.id} className="flex flex-wrap items-center gap-2">
          <AssetIcon symbol={w.currency} className="size-5" />
          <span className="w-16 text-xs font-semibold">{w.currency}</span>
          <span className="w-32 font-mono text-xs text-muted-foreground">
            {Number(w.balance).toLocaleString(undefined, { maximumFractionDigits: 8 })}
          </span>
          <input
            value={amounts[w.currency] ?? ""}
            onChange={(e) => setAmounts((p) => ({ ...p, [w.currency]: e.target.value }))}
            placeholder="Amount"
            inputMode="decimal"
            className="h-8 w-28 rounded-md border border-border bg-background px-2 text-xs"
          />
          {(["delta", "set"] as const).map((mode) => (
            <button
              key={mode}
              disabled={mutation.isPending}
              onClick={() => {
                const value = Number(amounts[w.currency]);
                if (!Number.isFinite(value)) return toast.error("Enter a valid amount.");
                mutation.mutate({ userId, currency: w.currency, amount: value, mode });
              }}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {mode === "delta" ? "Adjust by" : "Set to"}
            </button>
          ))}
        </li>
      ))}
    </ul>
  );
}

const KYC_FILTERS = [
  { key: "all", label: "All" },
  { key: "l1", label: "Lv.1 pending" },
  { key: "l2", label: "Lv.2 pending" },
  { key: "expiring", label: "ID expiring" },
] as const;

function KycQueue({ kyc, onDone }: { kyc: any[]; onDone: () => void }) {
  const [filter, setFilter] = useState<(typeof KYC_FILTERS)[number]["key"]>("all");
  const soon = Date.now() + 30 * 86_400_000;
  const expiring = (k: any) => k.document_expires_at && new Date(k.document_expires_at).getTime() < soon;
  const match = (k: any) =>
    filter === "all" ||
    (filter === "l1" && k.status === "pending") ||
    (filter === "l2" && k.level2_status === "pending") ||
    (filter === "expiring" && expiring(k));
  const rows = kyc.filter(match);
  const count = (key: string) =>
    kyc.filter((k) =>
      key === "all" ? true : key === "l1" ? k.status === "pending" : key === "l2" ? k.level2_status === "pending" : expiring(k),
    ).length;
  return (
    <Card title={`KYC / Compliance desk (${kyc.length})`}>
      <div className="mb-3 flex gap-1.5 overflow-x-auto whitespace-nowrap">
        {KYC_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`touch-manipulation rounded-full border px-3 py-1 text-[11px] font-semibold ${
              filter === f.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
            }`}
          >
            {f.label} ({count(f.key)})
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <Empty label="No submissions in this queue." />
      ) : (
        <ul className="space-y-2">
          {rows.map((k) => (
            <KycRow key={k.id} row={k} onDone={onDone} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function KycRow({ row, onDone }: { row: any; onDone: () => void }) {
  const review = useReview(reviewKyc, onDone, "KYC");
  const fetchDocs = useServerFn(getKycDocumentUrls);
  const revoke = useServerFn(unverifyKyc);
  const [docsVisible, setDocsVisible] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const unverify = useMutation({
    mutationFn: (input: { id: string; note?: string }) => revoke({ data: input }),
    onSuccess: () => {
      toast.success("User reverted to pending verification.");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [docs, setDocs] = useState<{ document: string | null; selfie: string | null } | null>(null);
  const [note, setNote] = useState("");

  const load = useMutation({
    mutationFn: () => fetchDocs({ data: { id: row.id } }),
    onSuccess: (res: any) => setDocs(res),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{row.full_name}</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {row.country} · {row.document_type} · {new Date(row.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`flex items-center gap-1.5 text-xs uppercase ${STATUS_TONE[row.status] ?? ""}`}>
            <TierBadge tier="L1" /> {row.status}
          </span>
          <span
            className={`flex items-center gap-1.5 text-[11px] uppercase ${STATUS_TONE[row.level2_status] ?? "text-muted-foreground"}`}
          >
            <TierBadge tier="L2" /> {row.level2_status ?? "unsubmitted"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setReviewOpen(true)}
          className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
        >
          {row.status === "pending" || row.level2_status === "pending" ? "Review submission" : "Open inspection"}
        </button>
        {row.status === "approved" && (
          <button
            disabled={unverify.isPending}
            onClick={() => unverify.mutate({ id: row.id, note: note || undefined })}
            className="rounded-md border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-ops-amber hover:bg-ops-amber-bg disabled:opacity-50"
          >
            Unverify user
          </button>
        )}
      </div>

      {docsVisible && docs && (
        <div className="mt-3 flex flex-wrap gap-3">
          {docs.document && (
            <img
              src={docs.document}
              alt={`${row.full_name} identity document`}
              className="h-40 rounded border border-border object-contain"
            />
          )}
          {docs.selfie && (
            <img
              src={docs.selfie}
              alt={`${row.full_name} verification selfie`}
              className="h-40 rounded border border-border object-contain"
            />
          )}
          {!docs.document && !docs.selfie && (
            <p className="text-xs text-muted-foreground">No files uploaded.</p>
          )}
        </div>
      )}

      {reviewOpen && (
        <KycReviewDrawer row={row} onClose={() => setReviewOpen(false)} onDone={onDone} />
      )}
    </li>
  );
}

function BroadcastTab({ profiles }: { profiles: any[] }) {
  const send = useServerFn(broadcastNotification);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState("");
  const [segment, setSegment] = useState<"all" | "vip" | "unverified" | "verified">("all");

  const mutation = useMutation({
    mutationFn: (input: any) => send({ data: input }),
    onSuccess: (r: any) => {
      toast.success(`Notification sent to ${r?.delivered ?? 0} account(s).`);
      setTitle("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card title="Send notification">
      <div className="max-w-xl space-y-3">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="">Audience segment (below)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name} - {String(p.id).slice(0, 8)}…
            </option>
          ))}
        </select>
        {!userId && (
          <div className="flex flex-wrap gap-1.5">
            {([
              ["all", "All users"],
              ["vip", "VIPs"],
              ["verified", "Verified"],
              ["unverified", "Unverified"],
            ] as const).map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSegment(k)}
                className={`touch-manipulation rounded-full border px-3 py-1 text-xs ${segment === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
              >
                {l}
              </button>
            ))}
          </div>
        )}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message body"
          rows={4}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        />
        <button
          disabled={mutation.isPending || title.trim().length < 2 || body.trim().length < 2}
          onClick={() =>
            mutation.mutate({
              title: title.trim(),
              body: body.trim(),
              userId: userId || null,
              segment,
            })
          }
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Send notification
        </button>
      </div>
    </Card>
  );
}

function explorerUrl(network: string | null | undefined, hash: string): string | null {
  const n = String(network ?? "").toUpperCase();
  if (n.includes("TRC")) return `https://tronscan.org/#/transaction/${hash}`;
  if (n.includes("ERC") || n === "ETH") return `https://etherscan.io/tx/${hash}`;
  if (n.includes("BEP") || n.includes("BSC")) return `https://bscscan.com/tx/${hash}`;
  if (n.includes("BTC") || n.includes("BITCOIN")) return `https://mempool.space/tx/${hash}`;
  if (n.includes("SOL")) return `https://solscan.io/tx/${hash}`;
  return null;
}

/** Format-only check of a receiving address against its network. */
function addressValid(network: string | null | undefined, addr: string): boolean {
  const n = String(network ?? "").toUpperCase();
  const a = String(addr ?? "").trim();
  if (n.includes("TRC")) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (n.includes("ERC") || n.includes("BEP") || n.includes("BSC") || n === "ETH") return /^0x[0-9a-fA-F]{40}$/.test(a);
  if (n.includes("BTC") || n.includes("BITCOIN")) return /^(bc1[0-9a-z]{25,62}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/.test(a);
  if (n.includes("SOL")) return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  return a.length >= 20;
}
