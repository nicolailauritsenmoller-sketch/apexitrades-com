import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ThemeSetting } from "@/lib/theme";
import {
  BadgeCheck,
  Copy,
  Gift,
  LifeBuoy,
  LogOut,
  MonitorSmartphone,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";

import { supabase } from "@/integrations/supabase/client";
import { PasswordInput } from "@/components/PasswordInput";
import { formatMoney } from "@/lib/instruments";
import { getProfileOverview, updateProfile } from "@/lib/profile.functions";
import { getMyKyc, submitKyc } from "@/lib/kyc.functions";
import { getMyAccess } from "@/lib/admin.functions";
import {
  CREDIT_SCORE_MAX,
  CREDIT_SCORE_MIN,
  MIN_WITHDRAWAL_CREDIT_SCORE,
  creditScoreBand,
} from "@/lib/limits";
import {
  listSessions,
  registerCurrentDevice,
  removeSession,
  signOutEverywhere,
} from "@/lib/sessions";
import { LEGAL_DOCS, type LegalDoc } from "@/lib/legal-content";
import { TicketDialog } from "@/components/support/TicketDialog";
import { SecurityReportDialog } from "@/components/support/SecurityReportDialog";
import { VipChatDialog } from "@/components/support/VipChatDialog";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { VIP_ROLES } from "@/lib/vip";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — identity, security & referrals | Velocity Trade" },
      {
        name: "description",
        content:
          "Manage your Velocity Trade account: identity verification, wallet balances, password security, referral rewards and signed-in devices.",
      },
      { property: "og:title", content: "My Profile — Velocity Trade" },
      {
        property: "og:description",
        content: "Identity verification, balances, security settings, referrals and device management.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => <div className="p-8 text-sm">Nothing here.</div>,
});

const KYC_TONE: Record<string, string> = {
  unverified: "border-border text-muted-foreground",
  pending: "border-amber-400/40 text-amber-400",
  approved: "border-bull/40 text-bull",
  rejected: "border-bear/40 text-bear",
};

const KYC_LABEL: Record<string, string> = {
  unverified: "Unverified",
  pending: "Pending review",
  approved: "Verified",
  rejected: "Rejected",
};

function Card({
  title,
  value,
  hint,
  tone,
}: {
  title: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className={`mt-2 font-display text-xl font-bold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Wallet;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h2 className="font-display text-sm font-bold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copied`),
    () => toast.error("Could not copy"),
  );
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const fetchKyc = useServerFn(getMyKyc);
  const saveProfile = useServerFn(updateProfile);
  const sendKyc = useServerFn(submitKyc);
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);

  const overview = useQuery({
    queryKey: ["profile-overview"],
    queryFn: () => fetchOverview(),
    refetchInterval: 30_000,
  });
  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  const fetchAccess = useServerFn(getMyAccess);
  const access = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    retry: false,
    staleTime: 60_000,
  });

  const profile = overview.data?.profile;
  const balances = overview.data?.balances;
  const metrics = overview.data?.metrics;

  // Device sessions
  useEffect(() => {
    if (!profile?.id) return;
    registerCurrentDevice(profile.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ["sessions"] }))
      .catch(() => undefined);
  }, [profile?.id, queryClient]);

  const sessions = useQuery({ queryKey: ["sessions"], queryFn: listSessions });

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


  const removeDevice = useMutation({
    mutationFn: removeSession,
    onSuccess: () => {
      toast.success("Device removed");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logoutAll = useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: () => {
      window.location.href = "/auth";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const status = kyc.data?.status ?? "unverified";
  const creditScore = Number((profile as any)?.creditScore ?? 750);
  const creditBand = creditScoreBand(creditScore);
  const needsResubmit = status === "rejected" || kyc.data?.expired === true;

  const referralLink = useMemo(() => {
    if (typeof window === "undefined" || !profile?.referralCode) return "";
    return `${window.location.origin}/auth?ref=${profile.referralCode}`;
  }, [profile?.referralCode]);

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-5">
        {/* 1. Identity header */}
        <section className="rounded-lg border border-border bg-card p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <UserAvatar className="size-16" alt="Account avatar" />
            </div>


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
                className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 font-mono text-xs font-bold tracking-wide"
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
              disabled={
                nameMutation.isPending || displayName.trim().length < 2 || nameLockedDays > 0
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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

        {/* 3. Financial dashboard */}
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
                <span className="text-sm font-medium text-muted-foreground">
                  {creditBand.label}
                </span>
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

        {/* 2. KYC */}
        <Section
          icon={BadgeCheck}
          title="Identity verification (KYC)"
          description="Upload a government ID and a live selfie to unlock withdrawals."
        >
          <KycPanel
            kyc={kyc.data ?? null}
            userId={profile?.id ?? null}
            needsResubmit={needsResubmit}
            onSubmit={async (payload) => {
              await sendKyc({ data: payload });
              toast.success("Documents submitted for review");
              queryClient.invalidateQueries({ queryKey: ["my-kyc"] });
            }}
          />
        </Section>

        {/* 4. Security */}
        <Section
          icon={ShieldCheck}
          title="Security & settings"
          description="Appearance preference and account password."
        >
          <div className="space-y-4">
            <ThemeSetting />
            <PasswordForm email={profile?.email ?? null} />
          </div>
        </Section>

        {/* 5. Referrals */}
        <Section icon={Gift} title="Referral program" description="Earn rewards for every trader you invite.">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-border p-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Referral code</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1 font-mono text-sm">
                  {profile?.referralCode ?? "—"}
                </code>
                <button
                  onClick={() => profile?.referralCode && copy(profile.referralCode, "Referral code")}
                  className="rounded-md border border-border p-2"
                  aria-label="Copy referral code"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Referral link</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-secondary px-2 py-1 font-mono text-xs">
                  {referralLink || "—"}
                </code>
                <button
                  onClick={() => referralLink && copy(referralLink, "Referral link")}
                  className="rounded-md border border-border p-2"
                  aria-label="Copy referral link"
                >
                  <Copy className="size-4" />
                </button>
              </div>
            </div>
            <Card title="Friends invited" value={String(overview.data?.referrals.invited ?? 0)} />
            <Card
              title="Rewards earned"
              value={formatMoney(overview.data?.referrals.rewards ?? 0, "USDT")}
            />
          </div>
        </Section>

        {/* 6. Devices */}
        <Section
          icon={MonitorSmartphone}
          title="Device management"
          description="Devices currently signed in to your account."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Device</th>
                  <th className="py-2 pr-3">IP</th>
                  <th className="py-2 pr-3">Country</th>
                  <th className="py-2 pr-3">Last active</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(sessions.data ?? []).map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-2 pr-3">
                      {s.browser} on {s.os}
                      {s.isCurrent && (
                        <span className="ml-2 rounded-full border border-bull/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-bull">
                          This device
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{s.ip ?? "—"}</td>
                    <td className="py-2 pr-3">{s.country ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(s.lastActiveAt).toLocaleString()}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => removeDevice.mutate(s.id)}
                        disabled={s.isCurrent}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
                      >
                        <Trash2 className="size-3" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {(sessions.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                      No devices recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button
            onClick={() => logoutAll.mutate()}
            className="mt-4 inline-flex items-center gap-2 rounded-md border border-bear/40 px-3 py-2 text-sm text-bear"
          >
            <LogOut className="size-4" /> Log out all devices
          </button>
        </Section>

        {access.data?.isStaff ? (
          <Section
            icon={ShieldCheck}
            title="Operations Console"
            description="Staff-only backend administration."
          >
            <Link
              to="/sys-portal-x97"
              className="inline-flex touch-manipulation items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <ShieldCheck className="size-4" /> Open Admin Panel
            </Link>
          </Section>
        ) : null}

        {/* 7. Support & legal */}
        <div className="grid gap-3 md:grid-cols-2">
          <Section icon={LifeBuoy} title="Support" description="We're here around the clock.">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => document.querySelector<HTMLButtonElement>("[data-chat-toggle]")?.click()}
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                Live chat
              </button>
              <button
                onClick={() => setTicketOpen(true)}
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                Submit a ticket
              </button>
              <button
                onClick={() => setLegal(LEGAL_DOCS.faq)}
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                FAQs
              </button>
              <button
                onClick={() => setLegal(LEGAL_DOCS.help)}
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
              >
                Help center
              </button>
              <a
                href="mailto:support@velocitytrade.com"
                className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary sm:col-span-2"
              >
                📧 Email support — support@velocitytrade.com
              </a>
              <button
                onClick={() => setSecurityOpen(true)}
                className="inline-flex items-center gap-2 rounded-md border border-bear/40 px-3 py-2 text-left text-sm text-bear hover:bg-bear/10 sm:col-span-2"
              >
                <ShieldAlert className="size-4" /> Report a security issue
              </button>
            </div>

            <div className="mt-4 rounded-md border border-emerald-600/30 bg-emerald-600/5 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">VIP Live Chat</p>
                  <p className="text-xs text-muted-foreground">
                    Dedicated specialists — unlocked on request via customer support.
                  </p>
                </div>
                <button
                  onClick={() => setVipOpen(true)}
                  className="shrink-0 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Open
                </button>
              </div>
              <ul className="mt-3 grid gap-1 sm:grid-cols-2">
                {VIP_ROLES.map((r) => (
                  <li key={r.key} className="text-xs text-muted-foreground">
                    · {r.label}
                  </li>
                ))}
              </ul>
            </div>
          </Section>


          <Section icon={ShieldCheck} title="Legal center" description="Policies governing your account.">
            <div className="grid gap-2">
              {(["terms", "privacy", "risk", "aml"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setLegal(LEGAL_DOCS[key])}
                  className="rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-secondary"
                >
                  {LEGAL_DOCS[key].title}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {legal && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 backdrop-blur"
          role="dialog"
          aria-modal="true"
          onClick={() => setLegal(null)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-bold">{legal.title}</h3>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {legal.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            <button
              onClick={() => setLegal(null)}
              className="mt-5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <TicketDialog open={ticketOpen} onOpenChange={setTicketOpen} />
      <SecurityReportDialog open={securityOpen} onOpenChange={setSecurityOpen} />
      <VipChatDialog open={vipOpen} onOpenChange={setVipOpen} />
    </AppShell>

  );
}

type KycData = Awaited<ReturnType<typeof getMyKyc>>;

function KycPanel({
  kyc,
  userId,
  needsResubmit,
  onSubmit,
}: {
  kyc: KycData;
  userId: string | null;
  needsResubmit: boolean;
  onSubmit: (payload: {
    fullName: string;
    dateOfBirth: string;
    country: string;
    address: string;
    documentType: "passport" | "id_card" | "drivers_license";
    documentNumber: string;
    documentPath: string;
    selfiePath: string;
    documentExpiresAt?: string;
  }) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    country: "",
    address: "",
    documentType: "passport" as "passport" | "id_card" | "drivers_license",
    documentNumber: "",
    documentExpiresAt: "",
  });
  const [docFile, setDocFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const showForm = open || !kyc || needsResubmit;

  async function upload(file: File, kind: string) {
    const path = `${userId}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supabase.storage.from("kyc-documents").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!docFile || !selfieFile) {
      toast.error("Upload both your document and a selfie.");
      return;
    }
    setBusy(true);
    try {
      const [documentPath, selfiePath] = await Promise.all([
        upload(docFile, "document"),
        upload(selfieFile, "selfie"),
      ]);
      await onSubmit({
        ...form,
        documentPath,
        selfiePath,
        documentExpiresAt: form.documentExpiresAt || undefined,
      });
      setOpen(false);
      setDocFile(null);
      setSelfieFile(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {kyc && (
        <div className="rounded-md border border-border p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{kyc.fullName}</p>
              <p className="text-xs text-muted-foreground">
                {kyc.documentType.replace("_", " ")} · {kyc.country} · submitted{" "}
                {new Date(kyc.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${KYC_TONE[kyc.status]}`}
            >
              {KYC_LABEL[kyc.status] ?? kyc.status}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Document expiry:{" "}
            {kyc.documentExpiresAt ? new Date(kyc.documentExpiresAt).toLocaleDateString() : "not provided"}
            {kyc.expired && <span className="ml-2 text-bear">Expired</span>}
          </p>
          {kyc.adminNote && <p className="mt-1 text-xs text-amber-400">Reviewer note: {kyc.adminNote}</p>}
          <div className="mt-3 flex gap-3 text-xs">
            {kyc.documentUrl && (
              <a href={kyc.documentUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                View document
              </a>
            )}
            {kyc.selfieUrl && (
              <a href={kyc.selfieUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                View selfie
              </a>
            )}
          </div>
          {!showForm && (
            <button
              onClick={() => setOpen(true)}
              className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs"
            >
              Re-submit documents
            </button>
          )}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <input
            required
            placeholder="Full legal name"
            value={form.fullName}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Country"
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            required
            placeholder="Residential address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={form.documentType}
            onChange={(e) =>
              setForm({ ...form, documentType: e.target.value as typeof form.documentType })
            }
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="passport">Passport</option>
            <option value="id_card">Government ID card</option>
            <option value="drivers_license">Driver's license</option>
          </select>
          <input
            required
            placeholder="Document number"
            value={form.documentNumber}
            onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <label className="text-xs text-muted-foreground">
            Document expiry date
            <input
              type="date"
              value={form.documentExpiresAt}
              onChange={(e) => setForm({ ...form, documentExpiresAt: e.target.value })}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </label>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            <label className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Government ID / passport / licence
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              {docFile && <span className="mt-1 block text-foreground">{docFile.name}</span>}
            </label>
            <label className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Live selfie photo
              <input
                type="file"
                accept="image/*"
                capture="user"
                onChange={(e) => setSelfieFile(e.target.files?.[0] ?? null)}
                className="mt-2 block w-full text-xs"
              />
              {selfieFile && <span className="mt-1 block text-foreground">{selfieFile.name}</span>}
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-2"
          >
            {busy ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      )}
    </div>
  );
}

function PasswordForm({ email }: { email: string | null }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters.");
    if (next !== confirm) return toast.error("New passwords do not match.");
    if (!email) return toast.error("No email on this account.");

    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: current,
      });
      if (signInError) throw new Error("Current password is incorrect.");

      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);

      toast.success("Password updated");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
      <PasswordInput
        required
        placeholder="Current password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
      />
      <PasswordInput
        required
        placeholder="New password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
      />
      <PasswordInput
        required
        placeholder="Confirm new password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50 sm:col-span-3"
      >
        {busy ? "Updating…" : "Change password"}
      </button>
    </form>
  );
}
