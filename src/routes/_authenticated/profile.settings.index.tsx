import { createFileRoute } from "@tanstack/react-router";
import { Bell, Palette, ShieldCheck } from "lucide-react";
import { NavTile, SubPageHeader } from "@/components/profile/ui";

export const Route = createFileRoute("/_authenticated/profile/settings/")({
  head: () => ({
    meta: [
      { title: "Account Settings | Velocity Trade" },
      {
        name: "description",
        content:
          "Manage Velocity Trade security settings, notification preferences and display options such as currency, language and theme.",
      },
      { property: "og:title", content: "Account Settings — Velocity Trade" },
      {
        property: "og:description",
        content: "Security, notifications and display preferences in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsHub,
});

function SettingsHub() {
  return (
    <>
      <SubPageHeader title="Settings" description="Organised into security, alerts and display." />
      <div className="grid gap-3 md:grid-cols-2">
        <NavTile
          to="/profile/settings/security"
          icon={ShieldCheck}
          title="Security settings"
          description="Password updates, two-factor status and device management."
        />
        <NavTile
          to="/profile/settings/notifications"
          icon={Bell}
          title="Notifications"
          description="Email alerts, push, trade execution updates and marketing."
        />
        <NavTile
          to="/profile/settings/preferences"
          icon={Palette}
          title="Preferences"
          description="Display currency, language and light/dark theme."
        />
      </div>
    </>
  );
}
