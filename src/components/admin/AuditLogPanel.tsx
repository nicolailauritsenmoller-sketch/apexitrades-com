import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ScrollText } from "lucide-react";
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
  action.includes("reject")
    ? "text-bear"
    : action.includes("approve") || action.includes("grant")
      ? "text-bull"
      : "text-primary";

export function AuditLogPanel() {
  const fetchLogs = useServerFn(getAuditLogs);
  const logs = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: () => fetchLogs() as Promise<AuditRow[]>,
    refetchInterval: 30_000,
  });

  const rows = logs.data ?? [];

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <ScrollText className="size-4" /> Admin audit log
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
                details: JSON.stringify(r.details ?? {}),
              })),
            );
            if (!ok) toast.error("Nothing to export.");
          }}
        />
      </header>

      <div className="max-h-[70vh] divide-y divide-border/60 overflow-auto">
        {logs.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading audit trail…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No staff actions recorded yet.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm">
              <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleString()}
              </span>
              <span className={`w-44 shrink-0 font-medium ${ACTION_TONE(r.action)}`}>
                {r.action}
              </span>
              <span className="w-40 shrink-0 truncate text-xs text-muted-foreground">
                by {r.actor_name ?? r.actor_id.slice(0, 8)}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
                {r.target_user_id ? `→ ${r.target_user_id.slice(0, 8)} ` : ""}
                {JSON.stringify(r.details ?? {})}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
