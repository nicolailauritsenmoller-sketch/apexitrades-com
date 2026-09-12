import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Globe2,
  LogOut,
  MonitorSmartphone,
  Pause,
  Play,
  ShieldAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getTelemetryOverview,
  getUserTelemetry,
  terminateAllSessions,
  terminateSession,
} from "@/lib/telemetry.functions";

type Overview = Awaited<ReturnType<typeof getTelemetryOverview>>;
type SessionRow = Overview["sessions"][number];

const timeAgo = (iso: string) => {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function Panel({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border/70 bg-card/60 backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        {action}
      </header>
      <div className="p-3 sm:p-4">{children}</div>
    </section>
  );
}

const SessionMap = lazy(() => import("@/components/admin/SessionMap"));

/** Real tiled world map with live session pins (client-only). */
function WorldMap({
  sessions,
  onPick,
}: {
  sessions: SessionRow[];
  onPick: (userId: string) => void;
}) {
  return (
    <ClientOnly
      fallback={
        <div className="h-[320px] w-full animate-pulse rounded-xl border border-border bg-secondary/40 sm:h-[420px]" />
      }
    >
      <Suspense
        fallback={
          <div className="h-[320px] w-full animate-pulse rounded-xl border border-border bg-secondary/40 sm:h-[420px]" />
        }
      >
        <SessionMap sessions={sessions} onPick={onPick} />
      </Suspense>
    </ClientOnly>
  );
}

/** Video-style playback of the captured DOM interactions for one activity entry. */
function ReplayModal({
  entry,
  onClose,
}: {
  entry: { label: string; createdAt: string; domEvents: any[] };
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const events = entry.domEvents ?? [];

  useEffect(() => {
    if (!playing || idx >= events.length - 1) return;
    const gap = Math.min(
      3000,
      Math.max(120, (events[idx + 1]?.t ?? 0) - (events[idx]?.t ?? 0) || 400),
    );
    timer.current = setTimeout(() => setIdx((i) => i + 1), gap / speed);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, idx, speed, events]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold">{entry.label}</p>
            <p className="text-[11px] text-muted-foreground">
              {new Date(entry.createdAt).toLocaleString()} · {events.length} interactions
            </p>
          </div>
          <button onClick={onClose} className="touch-manipulation rounded-md p-1.5 hover:bg-secondary">
            <X className="size-4" />
          </button>
        </header>

        <div className="h-40 overflow-y-auto rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          {events.length === 0 && <p className="text-muted-foreground">No interactions captured.</p>}
          {events.slice(0, idx + 1).map((e, i) => (
            <p key={i} className={i === idx ? "text-foreground" : "text-muted-foreground"}>
              <span className="num">{(e.t / 1000).toFixed(1)}s</span> · {e.kind}
              {e.target ? ` → ${e.target}` : ""}
              {e.value ? ` "${e.value}"` : ""}
            </p>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="touch-manipulation rounded-md border border-border p-2"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={Math.max(0, events.length - 1)}
            value={idx}
            onChange={(e) => {
              setPlaying(false);
              setIdx(Number(e.target.value));
            }}
            className="flex-1 accent-primary"
          />
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`touch-manipulation rounded-md px-2 py-1 text-xs ${
                speed === s ? "bg-primary text-primary-foreground" : "border border-border"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function UserDrawer({ userId, onClose }: { userId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const fetchUser = useServerFn(getUserTelemetry);
  const killAll = useServerFn(terminateAllSessions);
  const q = useQuery({
    queryKey: ["telemetry-user", userId],
    queryFn: () => fetchUser({ data: { userId } }),
    refetchInterval: 15_000,
  });
  const [replay, setReplay] = useState<any | null>(null);

  const endAll = useMutation({
    mutationFn: () => killAll({ data: { userId } }),
    onSuccess: () => {
      toast.success("All devices signed out");
      qc.invalidateQueries({ queryKey: ["telemetry-user", userId] });
      qc.invalidateQueries({ queryKey: ["telemetry"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-background/70 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-card p-4">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-bold">
              {q.data?.profile?.display_name ?? "User"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {q.data?.profile?.email ?? "—"} · {q.data?.profile?.uid ?? "—"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => endAll.mutate()}
              className="touch-manipulation rounded-md border border-bear/40 px-2 py-1 text-xs text-bear"
            >
              End all sessions
            </button>
            <button onClick={onClose} className="touch-manipulation rounded-md p-1.5 hover:bg-secondary">
              <X className="size-4" />
            </button>
          </div>
        </header>

        <h3 className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Devices</h3>
        <div className="space-y-2">
          {(q.data?.sessions ?? []).map((s) => (
            <div key={s.id} className="rounded-lg border border-border p-3 text-xs">
              <p className="font-medium">
                {s.deviceModel} · {s.browser} {s.browserVersion ?? ""}
              </p>
              <p className="text-muted-foreground">
                {s.os} {s.osVersion ?? ""} · {s.screen ?? "—"} · {s.deviceType}
              </p>
              <p className="text-muted-foreground">
                {[s.city, s.region, s.country].filter(Boolean).join(", ") || "Unknown location"} ·{" "}
                {s.ip ?? "—"} · {s.isp ?? "—"}
              </p>
              <p className="text-muted-foreground">
                {s.online ? "Online" : "Offline"} · {timeAgo(s.lastActiveAt)} · {s.path ?? "—"}
              </p>
            </div>
          ))}
          {(q.data?.sessions ?? []).length === 0 && (
            <p className="text-xs text-muted-foreground">No devices recorded.</p>
          )}
        </div>

        <h3 className="mb-2 mt-5 text-[11px] uppercase tracking-widest text-muted-foreground">
          Activity stream
        </h3>
        <ul className="space-y-2 text-xs">
          {(q.data?.activity ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
              <span className="min-w-0">
                <span className="block truncate">{a.label}</span>
                <span className="block truncate text-muted-foreground">
                  {a.actionType} · {a.route ?? "—"} · {timeAgo(a.createdAt)}
                </span>
              </span>
              <button
                onClick={() => setReplay(a)}
                disabled={(a.domEvents ?? []).length === 0}
                className="shrink-0 touch-manipulation rounded-md border border-border px-2 py-1 disabled:opacity-40"
              >
                Replay
              </button>
            </li>
          ))}
          {(q.data?.activity ?? []).length === 0 && (
            <p className="text-muted-foreground">No activity recorded yet.</p>
          )}
        </ul>
      </div>
      {replay && <ReplayModal entry={replay} onClose={() => setReplay(null)} />}
    </div>
  );
}

/** Live world map, device inventory, activity stream and risk alerts. */
export function TelemetryPanel() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getTelemetryOverview);
  const kill = useServerFn(terminateSession);
  const [picked, setPicked] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["telemetry"],
    queryFn: () => fetchOverview(),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    const bump = () => qc.invalidateQueries({ queryKey: ["telemetry"] });
    const channel = supabase.channel("admin-telemetry");
    for (const table of ["user_sessions", "user_activity_logs"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, bump);
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const endOne = useMutation({
    mutationFn: (id: string) => kill({ data: { id } }),
    onSuccess: () => {
      toast.success("Device signed out");
      qc.invalidateQueries({ queryKey: ["telemetry"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessions = q.data?.sessions ?? [];
  const countries = useMemo(
    () => new Set(sessions.map((s) => s.country).filter(Boolean)).size,
    [sessions],
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Online now", value: String(q.data?.online ?? 0) },
          { label: "Tracked devices", value: String(sessions.length) },
          { label: "Countries", value: String(countries) },
          { label: "Risk alerts", value: String((q.data?.alerts ?? []).length) },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border/70 bg-card/60 p-3">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className="num mt-1 text-lg font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      <Panel title="Live location map" icon={Globe2}>
        <WorldMap sessions={sessions} onPick={setPicked} />
      </Panel>

      {(q.data?.alerts ?? []).length > 0 && (
        <Panel title="Risk alerts" icon={ShieldAlert}>
          <ul className="space-y-2 text-xs">
            {q.data!.alerts.map((a, i) => (
              <li
                key={`${a.userId}-${i}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-bear/30 bg-bear/5 px-3 py-2"
              >
                <span className="min-w-0 truncate">
                  <b>{a.name}</b> · {a.kind} — {a.detail}
                </span>
                <button
                  onClick={() => setPicked(a.userId)}
                  className="shrink-0 touch-manipulation rounded-md border border-border px-2 py-1"
                >
                  Inspect
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Active devices" icon={MonitorSmartphone}>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
            {sessions.length === 0 && <p className="text-muted-foreground">No sessions tracked.</p>}
            {sessions.map((s) => (
              <li key={s.id} className="rounded-lg border border-border p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => setPicked(s.userId)}
                    className="min-w-0 touch-manipulation text-left"
                  >
                    <span className="block truncate font-medium">
                      {s.name}
                      <span
                        className={`ml-2 inline-block size-1.5 rounded-full align-middle ${
                          s.online ? "bg-bull" : "bg-muted-foreground"
                        }`}
                      />
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {s.deviceModel} · {s.browser} · {s.os} {s.osVersion ?? ""}
                    </span>
                    <span className="block truncate text-muted-foreground">
                      {[s.city, s.country].filter(Boolean).join(", ") || "Unknown"} · {s.ip ?? "—"} ·{" "}
                      {timeAgo(s.lastActiveAt)}
                    </span>
                  </button>
                  <button
                    onClick={() => endOne.mutate(s.id)}
                    title="Terminate session"
                    className="shrink-0 touch-manipulation rounded-md border border-bear/40 p-1.5 text-bear"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Live activity stream" icon={Activity}>
          <ul className="max-h-96 space-y-2 overflow-y-auto text-xs">
            {(q.data?.activity ?? []).length === 0 && (
              <p className="text-muted-foreground">No activity recorded yet.</p>
            )}
            {(q.data?.activity ?? []).map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 border-b border-border pb-2"
              >
                <button onClick={() => setPicked(a.userId)} className="min-w-0 text-left">
                  <span className="block truncate">
                    <b>{a.name}</b> · {a.label}
                  </span>
                  <span className="block truncate text-muted-foreground">
                    {a.actionType} · {a.route ?? "—"} ·{" "}
                    {[a.city, a.country].filter(Boolean).join(", ") || a.ip || "—"}
                  </span>
                </button>
                <span className="num shrink-0 text-muted-foreground">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      {picked && <UserDrawer userId={picked} onClose={() => setPicked(null)} />}
    </div>
  );
}
