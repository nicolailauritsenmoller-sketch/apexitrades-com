import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Lock, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { WithdrawalPasswordForm } from "@/components/profile/WithdrawalPasswordForm";
import { DevicesPanel } from "@/components/profile/DevicesPanel";
import { getProfileOverview } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile/settings/security")({
  head: () => ({
    meta: [
      { title: "Security Settings | Velocity Trade" },
      {
        name: "description",
        content:
          "Update your Velocity Trade password, review two-factor authentication status and manage logged-in devices.",
      },
      { property: "og:title", content: "Security Settings — Velocity Trade" },
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
  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });
  const email = (overview.data as { profile?: { email?: string | null } } | undefined)?.profile?.email ?? null;

  return (
    <>
      <SubPageHeader
        title="Security settings"
        description="Password, two-factor authentication and device access."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <Section icon={KeyRound} title="Change password" description="Confirm your current password to set a new one.">
        <PasswordForm email={email} />
      </Section>

      <Section
        icon={Lock}
        title="Withdrawal password"
        description="A separate password required to confirm every withdrawal."
      >
        <WithdrawalPasswordForm />
      </Section>


      <Section
        icon={ShieldCheck}
        title="Two-factor authentication"
        description="Email one-time codes protect sign-in and password resets."
      >
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div>
            <p className="text-sm font-semibold">Email OTP</p>
            <p className="text-xs text-muted-foreground">
              A 6-digit code is required when signing in from a new device or resetting your password.
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-bull/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-bull">
            Active
          </span>
        </div>
      </Section>

      <Section
        icon={MonitorSmartphone}
        title="Devices"
        description="Sign out of devices you no longer recognise."
      >
        <DevicesPanel />
      </Section>
    </>
  );
}
