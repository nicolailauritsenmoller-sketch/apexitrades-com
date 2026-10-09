import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, LogOut, Lock, Monitor, Smartphone, Users, TrendingUp, ShieldAlert, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getActiveDesk, forceLogoutSession, instantLockout } from "@/lib/active-desk.functions";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { UserWorkspaceDrawer } from "@/components/admin/UserWorkspaceDrawer";
import { Button } from "@/components/ui/button";

type Row = Awaited<ReturnType<typeof getActiveDesk>>["rows"][number];

function flag(country?: string | null) {
  if (!country || !/^[A-Za-z]{2}$/.test(country)) return "";
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

function heartbeat(last: string, now: number) {
  const age = (now - new Date(last).getTime()) / 1000;
  if (age < 30) return { label: "Active", cls: "bg-bull shadow-[0_0_8px_var(--color-bull)] live-dot", age };
  if (age < 300) return { label: "Idle", cls: "bg-amber-400", age };
  return { label: "Backgrounded", cls: "bg-muted-foreground/40", age };
}

function ago(s: number) {
  return s < 60 ? `${Math.round(s)}s ago` : `${Math.round(s / 60)}m ago`;
}

export function ActiveUsersDesk() {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getActiveDesk);
  const logoutFn = useServerFn(forceLogoutSession);
  const lockFn = useServerFn(instantLockout);
  const q = useQuery({ queryKey: ["active-desk"], queryFn: () => fetchDesk(), refetchInterval: 10_000 });
  const [now, setNow] = useState(() => Date.now());
  const [role, setRole] = useState("all");
  const [device, setDevice] = useState("all");
  const [loc, setLoc] = useState("");
  const [inspect, setInspect] = useState<string | null>(null);
  const [action, setAction] = useState<{ kind: "logout" | "lock"; row: Row } | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const ch = supabase.channel("desk-active-desk")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, () => qc.invalidateQueries({ queryKey: ["active-desk"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const mut = useMutation({
    mutationFn: async ({ kind, row, reason }: { kind: "logout" | "lock"; row: Row; reason: string }) =>
      kind === "logout" ? logoutFn({ data: { userId: row.userId, sessionId: row.id, reason } }) : lockFn({ data: { userId: row.userId, reason } }),
    onSuccess: (_d, v) => { toast.success(v.kind === "logout" ? "Session terminated" : "Account locked and sessions ended"); qc.invalidateQueries({ queryKey: ["active-desk"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data?.rows ?? [];
  const filtered = useMemo(() => {
    const s = loc.trim().toLowerCase();
    return rows.filter((r) => (role === "all" || r.role === role) && (device === "all" || r.device === device) &&
      (!s || [r.ip, r.city, r.country, r.region, r.isp, r.name, r.uid, r.email].some((v) => String(v ?? "").toLowerCase().includes(s))));
  }, [rows, role, device, loc]);

  const live = rows.filter((r) => heartbeat(r.lastActiveAt, now).age < 300);
  const desktop = live.filter((r) => r.device === "Desktop").length;
  const mobile = live.length - desktop;

  const cards = [
    { icon: Users, label: "Total active sessions now", value: live.length, hint: `${new Set(live.map((r) => r.userId)).size} unique users` },
    { icon: Monitor, label: "Desktop vs mobile web", value: `${desktop} / ${mobile}`, hint: "Desktop / Mobile + tablet" },
    { icon: TrendingUp, label: "Peak concurrent today", value: q.data?.peak ?? 0, hint: "UTC day, 5-minute buckets" },
    { icon: ShieldAlert, label: "Multi-device flagged", value: q.data?.flagged ?? 0, hint: "More than one device or IP" },
  ];
  const sel = "h-10 rounded-md border border-input bg-background px-3 text-sm touch-manipulation";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground"><c.icon className="size-3.5" />{c.label}</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-3">
        <select className={sel} value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
          <option value="all">All roles</option><option value="trader">Trader</option><option value="staff">Staff</option><option value="admin">Super Admin</option>
        </select>
        <select className={sel} value={device} onChange={(e) => setDevice(e.target.value)} aria-label="Device">
          <option value="all">All devices</option><option>Desktop</option><option>Mobile</option><option>Tablet</option>
        </select>
        <label className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="Location, IP, ISP, name or UID" className={`${sel} w-full pl-9`} />
        </label>
        <span className="text-xs text-muted-foreground">{filtered.length} of {rows.length} sessions</span>
      </div>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-border text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr><th className="px-4 py-2">Heartbeat</th><th>User</th><th>Location / ISP</th><th>IP</th><th>Device</th><th>Page</th><th className="pr-4 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const hb = heartbeat(r.lastActiveAt, now);
              const place = [r.city, r.country].filter(Boolean).join(", ");
              return (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="px-4 py-3"><span className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${hb.cls}`} /><span className="text-xs">{hb.label}<span className="block font-mono text-muted-foreground">{ago(hb.age)}</span></span></span></td>
                  <td>
                    <p className="font-medium">{r.name} {r.frozen && <span className="ml-1 rounded bg-destructive/15 px-1.5 text-[10px] text-destructive">FROZEN</span>}{r.flagged && <span className="ml-1 rounded bg-amber-400/15 px-1.5 text-[10px] text-amber-500">MULTI-DEVICE</span>}</p>
                    <p className="font-mono text-xs text-muted-foreground">{r.uid ?? r.userId.slice(0, 8)} · {r.role === "admin" ? "Super Admin" : r.role === "staff" ? "Staff" : "Trader"}</p>
                  </td>
                  <td>{place ? <>{flag(r.country)} {place}</> : <span className="text-muted-foreground">Unresolved</span>}<p className="text-xs text-muted-foreground">{r.isp ?? "ISP unknown"}</p></td>
                  <td className="font-mono text-xs">{r.ip ?? "-"}</td>
                  <td><span className="flex items-center gap-1.5">{r.device === "Desktop" ? <Monitor className="size-3.5" /> : <Smartphone className="size-3.5" />}{r.device}</span><p className="text-xs text-muted-foreground">{r.browser} · {r.os}</p></td>
                  <td className="max-w-[160px] truncate font-mono text-xs">{r.path ?? "-"}</td>
                  <td className="pr-4">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="outline" onClick={() => setInspect(r.userId)}><Eye />Inspect</Button>
                      <Button size="sm" variant="outline" onClick={() => setAction({ kind: "logout", row: r })}><LogOut />Logout</Button>
                      <Button size="sm" variant="destructive" disabled={r.frozen} onClick={() => setAction({ kind: "lock", row: r })}><Lock />Freeze</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">{q.isLoading ? "Loading sessions..." : "No active sessions match these filters."}</td></tr>}
          </tbody>
        </table>
      </section>

      <AdminActionConfirm
        open={!!action}
        title={action?.kind === "lock" ? "Freeze account" : "Terminate session"}
        description={action?.kind === "lock"
          ? `Freeze ${action.row.name}: trading, withdrawals and sign-in are blocked and every live session ends immediately.`
          : `Sign ${action?.row.name ?? "this user"} out of every device. They can sign in again unless the account is frozen.`}
        pending={mut.isPending}
        onClose={() => setAction(null)}
        onConfirm={(reason) => mut.mutateAsync({ kind: action!.kind, row: action!.row, reason })}
      />
      {inspect && <UserWorkspaceDrawer userId={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}
