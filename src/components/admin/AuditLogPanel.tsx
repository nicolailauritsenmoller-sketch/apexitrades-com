import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText, Search, X } from "lucide-react";
import { getAuditLogs } from "@/lib/admin.functions";
import { downloadCsv } from "@/lib/csv";
import { ExportButton } from "./RolesCreditPanel";

type AuditRow = {
  id: string;
  actor_id: string;
  actor_name: string | null;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_TONE = (action: string) =>
  action.includes("reject") || action.includes("delete")
    ? "bg-bear/15 text-bear"
    : action.includes("approve") || action.includes("grant")
      ? "bg-bull/15 text-bull"
      : "bg-primary/15 text-primary";

const CATEGORIES = [
  { id: "all", label: "All actions" },
  { id: "balance", label: "Balance" },
  { id: "deposit", label: "Deposits" },
  { id: "withdrawal", label: "Withdrawals" },
  { id: "kyc", label: "KYC" },
  { id: "role", label: "Roles" },
  { id: "settings", label: "Settings" },
  { id: "user", label: "User" },
] as const;

const ipOf = (r: AuditRow) => {
  const d = (r.details ?? {}) as Record<string, unknown>;
  return String(d["ip"] ?? d["ip_address"] ?? d["actor_ip"] ?? "—");
};

export function AuditLogPanel() {
  const fetchLogs = useServerFn(getAuditLogs);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState<AuditRow | null>(null);

  const logs = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => fetchLogs() as Promise<AuditRow[]>,
    refetchInterval: 30_000,
  });

  const all = logs.data ?? [];
  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((r) => {
      if (cat !== "all" && !r.action.toLowerCase().includes(cat)) return false;
      if (!term) return true;
      return `${r.action} ${r.actor_name ?? ""} ${r.actor_id} ${r.target_user_id ?? ""} ${JSON.stringify(r.details ?? {})}`
        .toLowerCase()
        .includes(term);
    });
  }, [all, q, cat]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <ScrollText className="size-4" /> Operations activity audit log
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
            {rows.length}
          </span>
        </h2>
        <ExportButton
          label="Export CSV"
          onClick={() => {
            const ok = downloadCsv(
              `audit-log-${new Date().toISOString().slice(0, 10)}`,
              rows.map((r) => ({
                created_at: r.created_at,
                actor: r.actor_name ?? r.actor_id,
                action: r.action,
                target_user_id: r.target_user_id ?? "",
                ip: ipOf(r),
                details: JSON.stringify(r.details ?? {}),
              })),
            );
            if (!ok) toast.error("Nothing to export.");
          }}
        />
      </header>

      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl border border-border bg-background/60 px-3">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search action, staff, user or details…"
            className="h-9 w-full bg-transparent text-sm outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id)}
              className={`touch-manipulation rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                cat === c.id
                  ? "bg-primary/15 text-primary"
                  : "border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[70vh] divide-y divide-border/60 overflow-auto">
        {logs.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading audit trail…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No staff actions match this filter.</p>
        ) : (
          rows.map((r) => (
            <button
              key={r.id}
              onClick={() => setOpen(r)}
              className="flex w-full flex-wrap items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-secondary/50"
            >
              <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ACTION_TONE(r.action)}`}
              >
                {r.action}
              </span>
              <span className="w-36 shrink-0 truncate text-xs text-muted-foreground">
                by {r.actor_name ?? r.actor_id.slice(0, 8)}
              </span>
              <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                {ipOf(r)}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                {r.target_user_id ? `→ ${r.target_user_id.slice(0, 8)} ` : ""}
                {JSON.stringify(r.details ?? {})}
              </span>
            </button>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-sm">
          <button aria-label="Close" className="flex-1" onClick={() => setOpen(null)} />
          <aside className="h-full w-full max-w-sm overflow-y-auto border-l border-border bg-background p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-sm font-bold tracking-tight">Audit entry</h3>
              <button
                onClick={() => setOpen(null)}
                className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ["Action", open.action],
                ["Timestamp", new Date(open.created_at).toLocaleString()],
                ["Staff member", open.actor_name ?? open.actor_id],
                ["Staff ID", open.actor_id],
                ["Target user", open.target_user_id ?? "—"],
                ["IP address", ipOf(open)],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl border border-border/70 p-3">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 break-all font-mono text-xs">{v}</dd>
                </div>
              ))}
              <div className="rounded-xl border border-border/70 p-3">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Details
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-all font-mono text-xs">
                  {JSON.stringify(open.details ?? {}, null, 2)}
                </dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </section>
  );
}
