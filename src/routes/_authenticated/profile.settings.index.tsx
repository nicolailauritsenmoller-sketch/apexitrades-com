import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  BadgeCheck,
  Bell,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Crown,
  Globe2,
  LockKeyhole,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/UserAvatar";
import { copy, KYC_LABEL } from "@/components/profile/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getProfileOverview, updateProfile } from "@/lib/profile.functions";
import { getMyKyc } from "@/lib/kyc.functions";
import { getTwoFactorState, type TwoFactorState } from "@/lib/two-factor.functions";
import { usePreference } from "@/lib/preferences";
import { VIP_TIER_LABEL, isVip, isVipPending } from "@/lib/vip-tiers";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/profile/settings/")({
  head: () => ({
    meta: [
      { title: "Personal Information & Account Profile | Velocity Trade" },
      {
        name: "description",
        content: "Review your Velocity Trade identity, account tier, contact details and regional account settings.",
      },
      { property: "og:title", content: "Personal Information — Velocity Trade" },
      {
        property: "og:description",
        content: "Identity status, account limits, contact details and regional settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PersonalInformation,
});

const SETTINGS_NAV = [
  { to: "/profile/settings", label: "Personal Info", icon: User },
  { to: "/profile/settings/security", label: "Security", icon: ShieldCheck },
  { to: "/profile/settings/notifications", label: "Notifications", icon: Bell },
  { to: "/profile/settings/preferences", label: "Preferences", icon: SlidersHorizontal },
  { to: "/vip-upgrade", label: "VIP Membership", icon: Crown },
] as const;

function PersonalInformation() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const fetchKyc = useServerFn(getMyKyc);
  const fetchTwoFactor = useServerFn(getTwoFactorState);
  const saveProfile = useServerFn(updateProfile);
  const [timezone] = usePreference("timezone", "utc");
  const [displayName, setDisplayName] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });
  const kyc = useQuery({ queryKey: ["my-kyc"], queryFn: () => fetchKyc() });
  const twoFactor = useQuery({
    queryKey: ["two-factor-state"],
    queryFn: () => fetchTwoFactor() as Promise<TwoFactorState>,
  });
  const profile = overview.data?.profile;
  const kycStatus = kyc.data?.status ?? "unverified";
  const vipTier = String(profile?.vipTier ?? "regular");
  const verified = kycStatus === "approved";
  const enhancedVerified = kyc.data?.level2Status === "approved";

  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  const nameLockedDays = (() => {
    if (!profile?.nameLockedUntil) return 0;
    const difference = new Date(profile.nameLockedUntil).getTime() - Date.now();
    return difference > 0 ? Math.ceil(difference / 86_400_000) : 0;
  })();

  const nameMutation = useMutation({
    mutationFn: (name: string) => saveProfile({ data: { displayName: name } }),
    onSuccess: async () => {
      toast.success("Display name updated");
      await queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      const normalized = newEmail.trim().toLowerCase();
      if (!normalized || normalized === profile?.email?.toLowerCase()) {
        throw new Error("Enter a different email address.");
      }
      const { error } = await supabase.auth.updateUser({ email: normalized });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Verification links sent to confirm your email change");
      setNewEmail("");
      setEmailDialogOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createdDate = profile?.createdAt
    ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(profile.createdAt))
    : "—";
  const tierLabel = isVip(vipTier)
    ? VIP_TIER_LABEL[vipTier] ?? "VIP"
    : isVipPending(vipTier)
      ? "VIP (PENDING)"
      : "REGULAR";

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-semibold uppercase text-muted-foreground">Account Settings</p>
        <h1 className="mt-1 text-2xl font-bold">Personal Information</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your verified identity, contact details and account profile.</p>
      </header>

      <SettingsNavigation />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
              <UserAvatar className="size-16 sm:size-20" alt="Account profile" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-bold">{profile?.displayName ?? "Trader"}</h2>
                  {verified ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-bull/20 bg-bull/10 px-2.5 py-1 text-[10px] font-bold uppercase text-bull">
                      <BadgeCheck className="size-3.5" /> {enhancedVerified ? "Identity & Address Verified" : "KYC Verified"}
                    </span>
                  ) : (
                    <Link to="/profile/verification" className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[10px] font-semibold uppercase text-muted-foreground">
                      {KYC_LABEL[kycStatus] ?? "Unverified"}
                    </Link>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => profile?.uid && copy(profile.uid, "Account UID")}
                    disabled={!profile?.uid}
                    className="h-auto gap-1.5 p-0 font-mono text-xs text-muted-foreground hover:bg-transparent hover:text-foreground"
                  >
                    UID {profile?.uid ?? "—"} <Copy className="size-3.5" />
                  </Button>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" /> Account opened {createdDate}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-border bg-card">
            <header className="border-b border-border px-4 py-4 sm:px-5">
              <h2 className="text-base font-bold">Personal details</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Core identity and regional details attached to your account.</p>
            </header>
            <div className="divide-y divide-border">
              <DetailRow icon={User} label="Display Name" description="Public account name used across the trading desk.">
                <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                  <div className="flex gap-2">
                    <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} disabled={nameLockedDays > 0} maxLength={60} className="h-10 min-w-0 sm:w-56" aria-label="Display name" />
                    <Button type="button" size="sm" onClick={() => nameMutation.mutate(displayName.trim())} disabled={nameMutation.isPending || nameLockedDays > 0 || displayName.trim().length < 2 || displayName.trim() === profile?.displayName} className="h-10">
                      <Save className="size-4" /> Save
                    </Button>
                  </div>
                  <span className={nameLockedDays > 0 ? "text-[11px] font-semibold text-warning" : "text-[11px] text-muted-foreground"}>
                    {nameLockedDays > 0 ? `Name locked • ${nameLockedDays} days remaining` : "Eligible for a change • 60-day cooldown applies"}
                  </span>
                </div>
              </DetailRow>

              <DetailRow icon={Mail} label="Email Address" description="Primary address for security and transaction notices.">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-sm font-medium">{maskEmail(profile?.email)}</span>
                  <StatusBadge active={profile?.emailVerified !== false}>Verified</StatusBadge>
                  <Button type="button" variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>Change Email</Button>
                </div>
              </DetailRow>

              <DetailRow icon={Phone} label="Phone Number" description="Contact number authorized for account recovery.">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <span className="text-sm font-medium">{maskPhone(profile?.phone)}</span>
                  <StatusBadge active={Boolean(twoFactor.data?.enabled)}>{twoFactor.data?.enabled ? "2FA Authorized" : "2FA Not Authorized"}</StatusBadge>
                  <Button asChild type="button" variant="outline" size="sm"><Link to="/profile/settings/security">Manage</Link></Button>
                </div>
              </DetailRow>

              <DetailRow icon={Globe2} label="Country of Residence" description="Jurisdiction recorded during identity verification.">
                <span className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold">{kyc.data?.country ?? "Not provided"}</span>
              </DetailRow>

              <DetailRow icon={Clock3} label="Timezone" description="Used for charts, statements and transaction records.">
                <div className="flex items-center gap-2">
                  <span className="rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold">{timezone === "utc" ? "UTC" : "Local Time"}</span>
                  <Button asChild type="button" variant="outline" size="sm"><Link to="/profile/settings/preferences">Edit</Link></Button>
                </div>
              </DetailRow>
            </div>
          </section>
        </div>

        <aside className="overflow-hidden rounded-lg border border-border bg-card lg:sticky lg:top-20">
          <header className="border-b border-border px-5 py-4">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Trading Tier & Volume</p>
          </header>
          <div className="space-y-5 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Trading tier</p>
                <p className="mt-1 text-lg font-bold">{tierLabel}</p>
              </div>
              <span className="grid size-10 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary"><Crown className="size-5" /></span>
            </div>
            <div className="border-t border-border pt-5">
              <p className="text-xs text-muted-foreground">Monthly trading volume</p>
              <p className="mt-1 text-sm font-semibold">Not available</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Volume tracking is not configured for this account.</p>
            </div>
            <Button asChild type="button" variant={isVip(vipTier) ? "outline" : "default"} className="w-full">
              <Link to="/vip-upgrade">{isVip(vipTier) ? "View VIP Membership" : isVipPending(vipTier) ? "View VIP Request" : "Upgrade Account Tier"}</Link>
            </Button>
          </div>
        </aside>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change email address</DialogTitle>
            <DialogDescription>Verification links will be sent before the new address becomes active.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => { event.preventDefault(); emailMutation.mutate(); }} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-semibold">New email address</span>
              <Input type="email" autoComplete="email" required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="name@example.com" />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEmailDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={emailMutation.isPending || !newEmail.trim()}>{emailMutation.isPending ? "Sending…" : "Send Verification"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsNavigation() {
  return (
    <nav aria-label="Account settings" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
      {SETTINGS_NAV.map(({ to, label, icon: Icon }) => {
        const active = to === "/profile/settings";
        return (
          <Button key={to} asChild type="button" variant="ghost" className={`h-11 shrink-0 rounded-none border-b-2 px-3 text-xs ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}>
            <Link to={to}><Icon className="size-4" /> {label}</Link>
          </Button>
        );
      })}
    </nav>
  );
}

function DetailRow({ icon: Icon, label, description, children }: { icon: LucideIcon; label: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-4" /></span>
        <div><p className="text-sm font-semibold">{label}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
      </div>
      <div className="min-w-0 sm:max-w-[55%]">{children}</div>
    </div>
  );
}

function StatusBadge({ active, children }: { active: boolean; children: ReactNode }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase ${active ? "border-bull/20 bg-bull/10 text-bull" : "border-border bg-secondary text-muted-foreground"}`}><span className={`size-1.5 rounded-full ${active ? "bg-bull" : "border border-current"}`} />{active ? <Check className="size-3" /> : null}{children}</span>;
}

function maskEmail(email?: string | null) {
  if (!email) return "Not provided";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"•".repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function maskPhone(phone?: string | null) {
  if (!phone) return "Not added";
  return `${phone.slice(0, Math.min(3, phone.length))} •••• ${phone.slice(-4)}`;
}