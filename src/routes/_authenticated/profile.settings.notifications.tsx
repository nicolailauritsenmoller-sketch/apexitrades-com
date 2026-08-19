import { createFileRoute } from "@tanstack/react-router";
import { Bell, Megaphone } from "lucide-react";
import { Section, SubPageHeader, ToggleRow } from "@/components/profile/ui";
import { usePreference } from "@/lib/preferences";

export const Route = createFileRoute("/_authenticated/profile/settings/notifications")({
  head: () => ({
    meta: [
      { title: "Notification Settings | Velocity Trade" },
      {
        name: "description",
        content:
          "Choose which Velocity Trade alerts you receive: email notices, push alerts, trade execution updates and marketing messages.",
      },
      { property: "og:title", content: "Notification Settings — Velocity Trade" },
      {
        property: "og:description",
        content: "Email, push, trade execution and marketing preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NotificationSettings,
});

function NotificationSettings() {
  const [email, setEmail] = usePreference("notifyEmail", true);
  const [push, setPush] = usePreference("notifyPush", true);
  const [trades, setTrades] = usePreference("notifyTrades", true);
  const [marketing, setMarketing] = usePreference("notifyMarketing", false);

  return (
    <>
      <SubPageHeader
        title="Notifications"
        description="Control how the platform reaches you."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <Section icon={Bell} title="Account alerts" description="Security, deposits, withdrawals and verification updates.">
        <div className="space-y-3">
          <ToggleRow
            label="Email alerts"
            description="Sign-in notices, deposit and withdrawal confirmations."
            checked={email}
            onChange={setEmail}
          />
          <ToggleRow
            label="Push notifications"
            description="Browser and installed-app notifications."
            checked={push}
            onChange={setPush}
          />
          <ToggleRow
            label="Trade execution updates"
            description="Fills, contract settlements and liquidation warnings."
            checked={trades}
            onChange={setTrades}
          />
        </div>
      </Section>

      <Section icon={Megaphone} title="Marketing" description="Optional product news and promotions.">
        <ToggleRow
          label="Marketing communications"
          description="Feature announcements, campaigns and referral offers."
          checked={marketing}
          onChange={setMarketing}
        />
        <p className="mt-3 text-xs text-muted-foreground">
          Preferences are saved to this device and synced to your account when functional cookies are allowed.
        </p>
      </Section>
    </>
  );
}
