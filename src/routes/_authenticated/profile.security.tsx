import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { DevicesPanel } from "@/components/profile/DevicesPanel";
import { listSessions } from "@/lib/sessions";
import { getProfileOverview } from "@/lib/profile.functions";

export const Route = createFileRoute("/_authenticated/profile/security")({
  head: () => ({
    meta: [
      { title: "Security Center | Velocity Trade" },
      {
        name: "description",
        content:
          "Review active sessions, recent login history and two-factor status for your Velocity Trade account.",
      },
      { property: "og:title", content: "Security Center - Velocity Trade" },
      {
        property: "og:description",
        content: "Active sessions, login history and account protection settings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecurityCenter,
});

function SecurityCenter() {
  const fetchOverview = useServerFn(getProfileOverview);
  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: listSessions });

  const rows = sessions.data ?? [];

  return (
    <>
      <SubPageHeader
        title="Security center"
        description="Monitor how and where your account is being accessed."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Active sessions
          </p>
          <p className="mt-2 font-display text-xl font-bold">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Two-factor auth
          </p>
          <p className="mt-2 font-display text-xl font-bold text-amber-500">Email OTP</p>
          <p className="mt-1 text-xs text-muted-foreground">
            One-time codes are sent to {overview.data?.profile.email ?? "your email"}.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Last sign-in
          </p>
          <p className="mt-2 font-display text-xl font-bold">
            {rows[0]?.lastActiveAt
              ? new Date(rows[0].lastActiveAt).toLocaleString()
              : "-"}
          </p>
        </div>
      </div>

      <Section
        icon={MonitorSmartphone}
        title="Devices & sessions"
        description="Revoke any device you no longer recognise."
      >
        <DevicesPanel />
      </Section>

      <Section
        icon={ShieldCheck}
        title="Login history"
        description="The most recent sign-ins recorded on this account."
      >
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No login activity recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.slice(0, 10).map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm"
              >
                <span className="font-medium">
                  {s.browser} · {s.os}
                </span>
                <span className="text-xs text-muted-foreground">
                  {s.country ?? "Unknown region"} · {s.ip ?? "IP hidden"} ·{" "}
                  {new Date(s.lastActiveAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        icon={KeyRound}
        title="Password & credentials"
        description="Change your password from settings."
      >
        <Link
          to={"/profile/settings/security" as never}
          className="inline-flex touch-manipulation items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          Open security settings
        </Link>
      </Section>
    </>
  );
}
