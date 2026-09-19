import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Logo";

export type MaintenanceConfig = {
  enabled: boolean;
  title: string;
  message: string;
  /** ISO timestamp for the estimated completion time. */
  until: string | null;
};

const DEFAULTS: MaintenanceConfig = {
  enabled: false,
  title: "Scheduled Maintenance",
  message:
    "Velocity Trade is currently undergoing scheduled maintenance. Trading, deposits and withdrawals are temporarily unavailable. Please check back shortly.",
  until: null,
};

export function normalizeMaintenance(value: unknown): MaintenanceConfig {
  const v = (value ?? {}) as Record<string, unknown>;
  return {
    enabled: Boolean(v['enabled']),
    title: typeof v['title'] === "string" && v['title'].trim() ? v['title'] : DEFAULTS.title,
    message:
      typeof v['message'] === "string" && v['message'].trim() ? v['message'] : DEFAULTS.message,
    until: typeof v['until'] === "string" && v['until'] ? v['until'] : null,
  };
}

/** Publicly readable maintenance state, polled so lockouts land without a manual refresh. */
export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ["maintenance-status"],
    queryFn: async (): Promise<MaintenanceConfig> => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "maintenance")
        .maybeSingle();
      return normalizeMaintenance(data?.value);
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** True when the signed-in account holds an elevated role that bypasses the lockout. */
function useBypassRole() {
  return useQuery({
    queryKey: ["maintenance-bypass-role"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return false;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
      return roles.includes("admin") || roles.includes("super_admin");
    },
    staleTime: 60_000,
  });
}

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [until]);
  if (!until) return null;
  const target = new Date(until).getTime();
  if (!Number.isFinite(target)) return null;
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return { h, m, s, done: diff <= 0, target };
}

function Segment({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[68px] rounded-xl border border-border bg-surface/60 px-3 py-2 text-center">
      <span className="num block text-2xl font-bold text-foreground">
        {String(value).padStart(2, "0")}
      </span>
      <span className="block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function MaintenanceScreen({ config }: { config: MaintenanceConfig }) {
  const countdown = useCountdown(config.until);
  const [checking, setChecking] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 [touch-action:manipulation]">
      <div className="w-full max-w-lg rounded-2xl border border-border/80 bg-card p-7 text-center shadow-2xl">
        <BrandMark className="mx-auto size-14" />
        <span className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-ops-amber">
          <ShieldCheck className="size-3.5" /> Platform maintenance
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">{config.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{config.message}</p>

        {countdown && (
          <div className="mt-6">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {countdown.done ? "Completion time reached" : "Estimated completion in"}
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Segment value={countdown.h} label="Hours" />
              <Segment value={countdown.m} label="Minutes" />
              <Segment value={countdown.s} label="Seconds" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Target: {new Date(countdown.target).toLocaleString()}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setChecking(true);
            window.location.reload();
          }}
          className="mt-7 inline-flex min-h-11 touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          disabled={checking}
        >
          <RefreshCw className={`size-4 ${checking ? "animate-spin" : ""}`} />
          {checking ? "Checking status…" : "Check status / Refresh"}
        </button>
      </div>
    </div>
  );
}

/** Small banner shown on the sign-in screen while the platform is locked. */
export function MaintenanceAuthNotice({ config }: { config: MaintenanceConfig }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left">
      <p className="text-xs font-semibold uppercase tracking-widest text-ops-amber">
        {config.title}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Logins are temporarily paused due to scheduled system maintenance. Only platform
        administrators can access the terminal right now.
      </p>
    </div>
  );
}

/** Persistent header chip shown while the platform is locked (visible to admins on bypass). */
export function MaintenanceBadge({ className = "" }: { className?: string }) {
  const { data: config } = useMaintenanceStatus();
  if (!config?.enabled) return null;
  return (
    <span
      title={config.title}
      className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-ops-amber ${className}`}
    >
      <ShieldCheck className="size-3" />
      Maintenance mode active
    </span>
  );
}

/** Keeps maintenance state fresh instantly via realtime updates on platform_settings. */
function useMaintenanceRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel("maintenance-settings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["maintenance-status"] });
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Routes that stay reachable during a lockout so administrators can sign in. */
const BYPASS_PREFIXES = ["/auth", "/reset-password", "/sys-portal-x97", "/admin", "/legal"];

/** Wraps the app and replaces it with the maintenance screen for non-admin visitors. */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = router.state.location.pathname;
  useMaintenanceRealtime();
  const { data: config } = useMaintenanceStatus();
  const { data: bypass, isLoading: roleLoading } = useBypassRole();

  if (!config?.enabled) return <>{children}</>;
  if (BYPASS_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return <>{children}</>;
  if (roleLoading || bypass) return <>{children}</>;

  return <MaintenanceScreen config={config} />;
}
