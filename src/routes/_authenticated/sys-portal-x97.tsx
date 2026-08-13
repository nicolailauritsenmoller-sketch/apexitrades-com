import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ShieldCheck,
  Wallet2,
  Megaphone,
  Users,
  Landmark,
  Gauge,
  LayoutDashboard,
  BarChart3,
  Receipt,
  LifeBuoy,
  Settings2,
  ScrollText,
  KeySquare,
  CreditCard,
  Radio,
  Wrench,
  Star,
  IdCard,
  MessagesSquare,
  Trash2,
  BadgeCheck,
  ShieldAlert,
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
import { RolesPanel, CreditScorePanel, ExportButton } from "@/components/admin/RolesCreditPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";
import { AnnouncementsPanel } from "@/components/admin/AnnouncementsPanel";
import { ActiveUsersPanel } from "@/components/admin/ActiveUsersPanel";
import { TradeCorrections } from "@/components/admin/TradeCorrections";
import { RatingsPanel } from "@/components/admin/RatingsPanel";
import { AgentProfilePanel } from "@/components/admin/AgentProfilePanel";
import { VipDesk } from "@/components/admin/VipDesk";
import { getVipDesk } from "@/lib/vip.functions";
import { SecurityReportsPanel } from "@/components/admin/SecurityReportsPanel";
import { VerifiedBadge, UidTag } from "@/components/VerifiedBadge";
import { downloadCsv } from "@/lib/csv";
import { silenceChatAlerts } from "@/lib/alerts";
import { AdminShell } from "@/components/AdminShell";
import { OpsToggles } from "@/components/admin/OpsToggles";
import { UserWorkspaceDrawer } from "@/components/admin/UserWorkspaceDrawer";
import { supabase } from "@/integrations/supabase/client";

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
      { id: "vip", label: "VIP Live Chat", icon: BadgeCheck },
      { id: "tickets", label: "Support tickets", icon: LifeBuoy },
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
    ],
  },
  {
    section: "People",
    items: [
      { id: "users", label: "Users & KYC", icon: Users },
      { id: "roles", label: "Roles & permissions", icon: KeySquare },
      { id: "credit", label: "Credit scores", icon: CreditCard },
    ],
  },
  {
    section: "Money",
    items: [
      { id: "deposits", label: "Deposits & approvals", icon: Wallet2 },
      { id: "withdrawals", label: "Withdrawals", icon: Landmark },
      { id: "transactions", label: "Transactions", icon: Receipt },
      { id: "addresses", label: "Receiving addresses", icon: ShieldCheck },
    ],
  },
  {
    section: "Engagement",
    items: [
      { id: "broadcast", label: "Broadcast", icon: Megaphone },
      { id: "ratings", label: "Ratings & reviews", icon: Star },
      { id: "agent", label: "Agent persona", icon: IdCard },
    ],
  },
  {
    section: "System",
    items: [
      { id: "audit", label: "Audit logs", icon: ScrollText },
      { id: "security", label: "Security reports", icon: ShieldAlert },
      { id: "settings", label: "Settings", icon: Settings2 },
    ],
  },
];

const TAB_IDS = NAV.flatMap((g) => g.items.map((i) => i.id));

type TabId = (typeof TAB_IDS)[number];

const STATUS_TONE: Record<string, string> = {
  pending: "text-amber-400",
  approved: "text-bull",
  rejected: "text-bear",
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
    <section className="rounded-lg border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
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
                ? "bg-bull/15 text-bull"
                : m.id === "force_loss"
                  ? "bg-bear/15 text-bear"
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
  const [tab, setTab] = useState<TabId>("overview");
  const [filter, setFilter] = useState<DeskFilter>({});
  const statusFilter = filter.status ?? null;
  const go = (next: string, nextFilter?: DeskFilter) => {
    setTab(next as TabId);
    setFilter(nextFilter ?? {});
  };


  const fetchAccess = useServerFn(getMyAccess);
  const fetchOverview = useServerFn(getAdminOverview);
  const fetchAnalytics = useServerFn(getAdminAnalytics);

  const access = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess() });
  const isAdmin = access.data?.isAdmin === true;

  // Unread live-chat counter for the sidebar badge.
  const fetchThreads = useServerFn(getSupportThreads);
  const threads = useQuery({
    queryKey: ["desk-unread"],
    queryFn: () => fetchThreads(),
    enabled: isAdmin,
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
    enabled: isAdmin,
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
    enabled: isAdmin,
    refetchInterval: 20_000,
  });

  const analyticsQuery = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: () => fetchAnalytics(),
    enabled: isAdmin,
    refetchInterval: 30_000,
  });

  // Live pending counters — refresh instantly on any queue change.
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

  if (!isAdmin) return <NotFoundScreen />;

  const data = overview.data;
  const analytics = analyticsQuery.data as Analytics | undefined;

  const activeLabel =
    NAV.flatMap((g) => g.items).find((i) => i.id === tab)?.label ?? "Dashboard";

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
              {NAV.map((group) => (
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
                      return (
                        <button
                          key={id}
                          onClick={() => {
                            go(id, alerting && !isChat ? { status: "pending" } : undefined);
                            if (isChat) silenceChatAlerts();
                          }}
                          className={`flex w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            tab === id
                              ? "bg-primary/15 font-medium text-primary"
                              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                          } ${
                            alerting
                              ? isChat
                                ? "animate-pulse border border-bear/60 text-foreground ring-2 ring-bear/30"
                                : "border border-red-500/70 text-foreground"
                              : isChat
                                ? "border border-primary/30"
                                : ""
                          }`}
                        >
                          <Icon
                            className={`size-4 shrink-0 ${alerting && !isChat ? "text-red-500" : ""}`}
                          />
                          <span className="truncate">{label}</span>
                          {pending > 0 && (
                            <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight">{activeLabel}</h1>
              <p className="text-sm text-muted-foreground">
                Approvals, roles, credit scores, outcome control and platform settings.
              </p>
            </div>
            <button
              onClick={refresh}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Refresh
            </button>
          </div>

          {tab === "corrections" && <TradeCorrections />}
          {tab === "active" && <ActiveUsersPanel />}
          {tab === "ratings" && <RatingsPanel />}
          {tab === "agent" && <AgentProfilePanel />}
          {tab === "vip" && <VipDesk />}
          {tab === "security" && <SecurityReportsPanel />}
          {tab === "roles" && <RolesPanel />}
          {tab === "credit" && <CreditScorePanel />}
          {tab === "audit" && <AuditLogPanel />}

          {overview.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading console…</p>
          ) : !data ? (
            <p className="text-sm text-bear">{(overview.error as Error)?.message ?? "No data."}</p>
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
                        ? "animate-pulse border-bear/60 bg-bear/10 ring-2 ring-bear/25"
                        : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <MessagesSquare className="size-5 text-primary" />
                    <div className="min-w-0">
                      <p className="font-display text-sm font-bold tracking-tight">Live Chat</p>
                      <p className="text-xs text-muted-foreground">
                        {unreadChats > 0
                          ? `${unreadChats} unread user message${unreadChats === 1 ? "" : "s"} waiting`
                          : "No unread messages — inbox clear"}
                      </p>
                    </div>
                    {unreadChats > 0 && (
                      <span className="ml-auto grid min-w-6 place-items-center rounded-full bg-red-600 px-2 py-1 text-xs font-bold leading-none text-white">
                        {unreadChats}
                      </span>
                    )}
                  </button>
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
              {tab === "trades" && (
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
              {tab === "tickets" && <SupportDesk initialView="tickets" />}
              {tab === "settings" && (
                <div className="space-y-4">
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
              {tab === "deposits" && (
                <DepositsTab rows={data.deposits} onDone={refresh} statusFilter={statusFilter} />
              )}
              {tab === "withdrawals" && (
                <WithdrawalsTab
                  rows={data.withdrawals}
                  onDone={refresh}
                  statusFilter={statusFilter}
                />
              )}
              {tab === "addresses" && <AddressesTab rows={data.addresses} onDone={refresh} />}
              {tab === "users" && (
                <UsersTab
                  profiles={data.profiles}
                  kyc={data.kyc}
                  onDone={refresh}
                  statusFilter={statusFilter}
                  userFilter={filter.users ?? null}
                />
              )}
              {tab === "broadcast" && (
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
        className="rounded-md bg-bull/15 px-3 py-1.5 text-xs font-semibold text-bull disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={pending}
        onClick={() => onAction("reject")}
        className="rounded-md bg-bear/15 px-3 py-1.5 text-xs font-semibold text-bear disabled:opacity-50"
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
        Proof of payment — click to enlarge
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
      {rows.length === 0 ? (
        <Empty label="No deposits submitted yet." />
      ) : (
        <ul className="space-y-3">
          {rows.map((d) => (
            <li key={d.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
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
                  tx: {d.tx_hash}
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
      {rows.length === 0 ? (
        <Empty label="No withdrawal requests yet." />
      ) : (
        <ul className="space-y-3">
          {rows.map((w) => (
            <li key={w.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={w.coin} className="size-7" />
                  <div>
                    <p className="text-sm font-semibold">
                      {Number(w.amount)} {w.coin}{" "}
                      <span className="text-xs text-muted-foreground">({w.network})</span>
                    </p>
                    <p className="break-all font-mono text-[11px] text-muted-foreground">
                      → {w.destination_address}
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
            className={`ml-auto text-[11px] uppercase ${row.active ? "text-bull" : "text-muted-foreground"}`}
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
            className="rounded-md border border-bear/40 px-3 py-1.5 text-xs font-semibold text-bear hover:bg-bear/10 disabled:opacity-50"
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
                    <span className={c.direction === "up" ? "text-bull" : "text-bear"}>
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
  profiles,
  kyc: kycAll,
  onDone,
  statusFilter,
}: {
  profiles: any[];
  kyc: any[];
  onDone: () => void;
  statusFilter?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const kyc = statusFilter ? kycAll.filter((k) => k.status === statusFilter) : kycAll;
  const verifiedIds = new Set(
    kycAll.filter((k) => k.status === "approved").map((k) => k.user_id),
  );

  return (
    <div className="space-y-4">
      <Card title={`Registered users (${profiles.length})`}>
        <ul className="space-y-2">
          {profiles.map((p) => (
            <li key={p.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {p.display_name}
                    {verifiedIds.has(p.id) && <VerifiedBadge />}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <UidTag uid={p.uid} /> · base {p.base_currency}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  className="ml-auto rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  {selected === p.id ? "Hide balances" : "Manage balances"}
                </button>
                <DeleteUserButton
                  userId={p.id}
                  name={p.display_name}
                  onDone={onDone}
                />
              </div>
              {selected === p.id && <BalanceEditor userId={p.id} onDone={onDone} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card title={`KYC submissions (${kyc.length})`}>
        {kyc.length === 0 ? (
          <Empty label="No KYC submissions yet." />
        ) : (
          <ul className="space-y-2">
            {kyc.map((k) => (
              <KycRow key={k.id} row={k} onDone={onDone} />
            ))}
          </ul>
        )}
      </Card>
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
        <span className="text-[11px] text-bear">Permanently delete everything?</span>
        <button
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
          className="rounded-md bg-bear px-3 py-1.5 text-xs font-semibold text-bear-foreground disabled:opacity-50"
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
      className="flex items-center gap-1.5 rounded-md border border-bear/40 px-3 py-1.5 text-xs font-semibold text-bear hover:bg-bear/10"
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

function KycRow({ row, onDone }: { row: any; onDone: () => void }) {
  const review = useReview(reviewKyc, onDone, "KYC");
  const fetchDocs = useServerFn(getKycDocumentUrls);
  const revoke = useServerFn(unverifyKyc);
  const [docsVisible, setDocsVisible] = useState(false);
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
        <span className={`text-xs uppercase ${STATUS_TONE[row.status] ?? ""}`}>{row.status}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          disabled={load.isPending}
          onClick={() => {
            if (docsVisible) {
              setDocsVisible(false);
              return;
            }
            setDocsVisible(true);
            if (!docs) load.mutate();
          }}
          className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {docsVisible ? "Hide ID document" : "View ID document"}
        </button>
        {row.status === "approved" && (
          <button
            disabled={unverify.isPending}
            onClick={() => unverify.mutate({ id: row.id, note: note || undefined })}
            className="rounded-md border border-amber-500/50 px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
          >
            Unverify user
          </button>
        )}
        {row.status === "pending" && (
          <>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note"
              className="h-8 min-w-[160px] flex-1 rounded-md border border-border bg-background px-2 text-xs"
            />
            <ReviewButtons
              pending={review.isPending}
              onAction={(action) => review.mutate({ id: row.id, action, note: note || undefined })}
            />
          </>
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
    </li>
  );
}

function BroadcastTab({ profiles }: { profiles: any[] }) {
  const send = useServerFn(broadcastNotification);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [userId, setUserId] = useState("");

  const mutation = useMutation({
    mutationFn: (input: any) => send({ data: input }),
    onSuccess: () => {
      toast.success("Notification sent.");
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
          <option value="">All users (system-wide announcement)</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name} — {String(p.id).slice(0, 8)}…
            </option>
          ))}
        </select>
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
