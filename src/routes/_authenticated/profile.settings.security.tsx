import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Fingerprint, KeyRound, Lock, MailCheck, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { SubPageHeader } from "@/components/profile/ui";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { WithdrawalPasswordForm } from "@/components/profile/WithdrawalPasswordForm";
import { DevicesPanel } from "@/components/profile/DevicesPanel";
import { TwoFactorSection } from "@/components/security/TwoFactorSection";
import { getProfileOverview } from "@/lib/profile.functions";
import { getTwoFactorState, type TwoFactorState } from "@/lib/two-factor.functions";
import { getWithdrawalPasswordStatus } from "@/lib/withdrawal-password.functions";
import {
  getAccountSecurityState,
  setAddressWhitelisting,
  setAntiPhishingCode,
  type AccountSecurityState,
} from "@/lib/account-security.functions";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/profile/settings/security")({
  head: () => ({
    meta: [
      { title: "Security Settings | Velocity Trade" },
      {
        name: "description",
        content:
          "Update your Velocity Trade password, review two-factor authentication status and manage logged-in devices.",
      },
      { property: "og:title", content: "Security Settings - Velocity Trade" },
      {
        property: "og:description",
        content: "Password updates, two-factor status and device management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecuritySettings,
});

function SecuritySettings() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const fetchTwoFactor = useServerFn(getTwoFactorState);
  const fetchWithdrawal = useServerFn(getWithdrawalPasswordStatus);
  const fetchSecurity = useServerFn(getAccountSecurityState);
  const saveAntiPhishing = useServerFn(setAntiPhishingCode);
  const saveWhitelisting = useServerFn(setAddressWhitelisting);
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });
  const twoFactor = useQuery({
    queryKey: ["two-factor-state"],
    queryFn: () => fetchTwoFactor() as Promise<TwoFactorState>,
  });
  const withdrawal = useQuery({
    queryKey: ["withdrawal-password-status"],
    queryFn: () => fetchWithdrawal(),
  });
  const security = useQuery({
    queryKey: ["account-security-state"],
    queryFn: () => fetchSecurity() as Promise<AccountSecurityState>,
  });
  const email = (overview.data as { profile?: { email?: string | null } } | undefined)?.profile?.email ?? null;
  const [dialog, setDialog] = useState<null | "login" | "withdrawal" | "two-factor" | "phishing">(null);
  const [antiPhishingCode, setAntiPhishingCodeValue] = useState("");

  const protections = [
    { label: "Login Password Active", active: true },
    { label: twoFactor.data?.enabled ? "2FA Enabled" : "2FA Missing", active: Boolean(twoFactor.data?.enabled) },
    { label: withdrawal.data?.isSet ? "Withdrawal Password Set" : "Withdrawal Password Missing", active: Boolean(withdrawal.data?.isSet) },
    { label: security.data?.antiPhishingConfigured ? "Anti-Phishing Code Set" : "Anti-Phishing Code Missing", active: Boolean(security.data?.antiPhishingConfigured) },
  ];
  const protectedCount = protections.filter((item) => item.active).length;
  const score = protectedCount >= 3 ? "High" : protectedCount === 2 ? "Medium" : "Low";

  const antiPhishingMutation = useMutation({
    mutationFn: () => saveAntiPhishing({ data: { code: antiPhishingCode } }),
    onSuccess: async () => {
      toast.success("Anti-phishing code updated");
      setAntiPhishingCodeValue("");
      setDialog(null);
      await queryClient.invalidateQueries({ queryKey: ["account-security-state"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const whitelistMutation = useMutation({
    mutationFn: (enabled: boolean) => saveWhitelisting({ data: { enabled } }),
    onSuccess: async (_result, enabled) => {
      toast.success(enabled ? "Withdrawal address whitelisting enabled" : "Withdrawal address whitelisting disabled");
      await queryClient.invalidateQueries({ queryKey: ["account-security-state"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function closeAndRefresh(queryKey: string) {
    setDialog(null);
    void queryClient.invalidateQueries({ queryKey: [queryKey] });
    void queryClient.invalidateQueries({ queryKey: ["account-security-state"] });
  }

  return (
    <div className="space-y-5">
      <SubPageHeader
        title="Security Settings"
        description="Manage account protection, fund access and active sessions."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary"><ShieldCheck className="size-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Account Security Score</p>
              <h1 className="mt-1 text-2xl font-bold">{score} <span className="text-base font-medium text-muted-foreground">({protectedCount}/4 Protected)</span></h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">Complete all protections to reduce unauthorized account and withdrawal access.</p>
            </div>
          </div>
          <div className="grid shrink-0 grid-cols-4 gap-1.5" aria-label={`${protectedCount} of 4 protections enabled`}>
            {protections.map((item) => <span key={item.label} className={`h-2 w-9 rounded-full ${item.active ? "bg-bull" : "bg-secondary"}`} />)}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4 sm:px-6">
          {protections.slice(1).map((item) => <StatusPill key={item.label} active={item.active}>{item.label}</StatusPill>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-4 sm:px-5">
          <h2 className="text-base font-bold">Account protections</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Sensitive changes open in a secure confirmation window.</p>
        </header>
        <div className="divide-y divide-border">
          <SecurityRow icon={KeyRound} title="Login Password" description={security.data?.loginPasswordUpdatedAt ? `Last updated ${new Date(security.data.loginPasswordUpdatedAt).toLocaleString()}` : "Protects sign-in access to your account."} status="Active" active action="Update" onAction={() => setDialog("login")} />
          <SecurityRow icon={Lock} title="Withdrawal Password / PIN" description={withdrawal.data?.updatedAt ? `Last changed ${new Date(withdrawal.data.updatedAt).toLocaleDateString()} · 7-working-day change protection` : "Required before funds can leave your account."} status={withdrawal.data?.isSet ? "Configured" : "Not Set"} active={Boolean(withdrawal.data?.isSet)} action={withdrawal.data?.isSet ? "Change" : "Set"} onAction={() => setDialog("withdrawal")} />
          <SecurityRow icon={Fingerprint} title="Two-Factor Authentication (2FA)" description="TOTP protection for sign-in and high-risk actions via Google Authenticator or Authy." status={twoFactor.data?.enabled ? "Enabled" : "Disabled"} active={Boolean(twoFactor.data?.enabled)} action={twoFactor.data?.enabled ? "Manage" : "Set Up"} onAction={() => setDialog("two-factor")} />
          <SecurityRow icon={MailCheck} title="Anti-Phishing Code" description={security.data?.antiPhishingConfigured ? `Configured · code ending in ${security.data.antiPhishingHint ?? "••"}` : "Add a private marker to identify official platform emails."} status={security.data?.antiPhishingConfigured ? "Configured" : "Missing"} active={Boolean(security.data?.antiPhishingConfigured)} action={security.data?.antiPhishingConfigured ? "Change" : "Set"} onAction={() => setDialog("phishing")} />
          <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><ShieldCheck className="size-4" /></span>
              <div><p className="text-sm font-semibold">Withdrawal Address Whitelisting</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Restrict withdrawals to addresses approved on your account.</p></div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <StatusPill active={Boolean(security.data?.addressWhitelistingEnabled)}>{security.data?.addressWhitelistingEnabled ? "Enabled" : "Disabled"}</StatusPill>
              <Switch checked={Boolean(security.data?.addressWhitelistingEnabled)} disabled={whitelistMutation.isPending} onCheckedChange={(checked) => whitelistMutation.mutate(checked)} aria-label="Withdrawal address whitelisting" />
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <header className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><MonitorSmartphone className="size-4" /></span>
          <div><h2 className="text-base font-bold">Active Devices & Sessions</h2><p className="mt-0.5 text-xs text-muted-foreground">Review access and revoke devices you no longer recognize.</p></div>
        </header>
        <div className="p-4 sm:p-5"><DevicesPanel /></div>
      </section>

      <SecurityDialog open={dialog === "login"} onOpenChange={(open) => setDialog(open ? "login" : null)} title="Update login password" description="Confirm your current password before setting a new credential.">
        <PasswordForm email={email} onSuccess={() => closeAndRefresh("account-security-state")} />
      </SecurityDialog>
      <SecurityDialog open={dialog === "withdrawal"} onOpenChange={(open) => setDialog(open ? "withdrawal" : null)} title={withdrawal.data?.isSet ? "Change withdrawal password" : "Set withdrawal password"} description="This separate credential locks all withdrawal requests.">
        <WithdrawalPasswordForm onSuccess={() => closeAndRefresh("withdrawal-password-status")} />
      </SecurityDialog>
      <SecurityDialog open={dialog === "two-factor"} onOpenChange={(open) => setDialog(open ? "two-factor" : null)} title="Two-factor authentication" description="Configure TOTP protection and your 12-word recovery phrase.">
        <TwoFactorSection />
      </SecurityDialog>
      <SecurityDialog open={dialog === "phishing"} onOpenChange={(open) => setDialog(open ? "phishing" : null)} title="Set anti-phishing code" description="Use 4-32 characters you will recognize. The full code is never displayed after saving.">
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); antiPhishingMutation.mutate(); }}>
          <label className="block space-y-2"><span className="text-xs font-semibold">Private code</span><input autoFocus minLength={4} maxLength={32} required value={antiPhishingCode} onChange={(event) => setAntiPhishingCodeValue(event.target.value)} placeholder="Enter your private email code" className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" /></label>
          <Button type="submit" className="w-full" disabled={antiPhishingMutation.isPending || antiPhishingCode.trim().length < 4}>{antiPhishingMutation.isPending ? "Saving…" : "Save Anti-Phishing Code"}</Button>
        </form>
      </SecurityDialog>
    </div>
  );
}

function StatusPill({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${active ? "border-bull/50 bg-bull/10 text-bull" : "border-border bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${active ? "bg-bull" : "border border-current"}`} />{children}</span>;
}

function SecurityRow({ icon: Icon, title, description, status, active, action, onAction }: { icon: typeof KeyRound; title: string; description: string; status: string; active: boolean; action: string; onAction: () => void }) {
  return <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-4" /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div></div><div className="flex items-center justify-between gap-3 sm:justify-end"><StatusPill active={active}>{status}</StatusPill><Button type="button" variant="outline" size="sm" onClick={onAction}>{active && action === "Update" ? <CheckCircle2 className="size-3.5" /> : null}{action}</Button></div></div>;
}

function SecurityDialog({ open, onOpenChange, title, description, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; children: ReactNode }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{children}</DialogContent></Dialog>;
}
