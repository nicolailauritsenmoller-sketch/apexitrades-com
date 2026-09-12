import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, Lock, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { PasswordForm } from "@/components/profile/PasswordForm";
import { WithdrawalPasswordForm } from "@/components/profile/WithdrawalPasswordForm";
import { DevicesPanel } from "@/components/profile/DevicesPanel";
import { TwoFactorSection } from "@/components/security/TwoFactorSection";
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
        description="Require a code from your authenticator app when signing in and for high-risk actions."
      >
        <TwoFactorSection />
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
