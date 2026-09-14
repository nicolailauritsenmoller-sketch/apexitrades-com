import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Bell, ChevronRight, Palette, ShieldCheck } from "lucide-react";
import { KYC_LABEL, KYC_TONE, NavTile, SubPageHeader } from "@/components/profile/ui";
import { getProfileOverview, updateProfile } from "@/lib/profile.functions";
import { getMyKyc } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/profile/settings/")({
  head: () => ({
    meta: [
      { title: "Personal Information & Settings | Velocity Trade" },
      {
        name: "description",
        content:
          "Update your display name and manage Velocity Trade security settings, notification preferences and display options.",
      },
      { property: "og:title", content: "Personal Information — Velocity Trade" },
      {
        property: "og:description",
        content: "Display name, security, notifications and display preferences in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsHub,
});

function SettingsHub() {
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getProfileOverview);
  const saveProfile = useServerFn(updateProfile);

  const overview = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchOverview() });
  const profile = overview.data?.profile;

  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    if (profile?.displayName) setDisplayName(profile.displayName);
  }, [profile?.displayName]);

  const nameLockedDays = (() => {
    const until = (profile as any)?.nameLockedUntil;
    if (!until) return 0;
    const diff = new Date(until).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 86_400_000) : 0;
  })();

  const nameMutation = useMutation({
    mutationFn: (name: string) => saveProfile({ data: { displayName: name } }),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["profile-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <SubPageHeader
        title="Personal Information"
        description="Your display name, plus security, alerts and display settings."
      />

      <section className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Display name</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
            disabled={nameLockedDays > 0}
            placeholder="Display name"
            aria-label="Display name"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-60"
          />
          <button
            onClick={() => nameMutation.mutate(displayName)}
            disabled={nameMutation.isPending || displayName.trim().length < 2 || nameLockedDays > 0}
            className="touch-manipulation rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
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
        <p className="mt-3 text-xs text-muted-foreground">Email · {profile?.email ?? "—"}</p>
      </section>

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
