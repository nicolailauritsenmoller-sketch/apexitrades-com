import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, ShieldAlert, X } from "lucide-react";
import { getUserSecurityDirectory } from "@/lib/admin-ops.functions";
import { UserAccountControls } from "@/components/admin/UserAccountControls";

type Row = Awaited<ReturnType<typeof getUserSecurityDirectory>>[number];

function Pill({ tone, children }: { tone: "ok" | "warn" | "bad" | "mute"; children: React.ReactNode }) {
  const cls =
    tone === "ok"
      ? "border-bull/40 bg-bull/10 text-bull"
      : tone === "warn"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
        : tone === "bad"
          ? "border-ops-red/40 bg-ops-red/10 text-ops-red"
          : "border-border text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

function kycTone(status: string) {
  if (status === "approved") return "ok" as const;
  if (status === "pending") return "warn" as const;
  if (status === "rejected") return "bad" as const;
  return "mute" as const;
}

/** Standalone security desk: full user roster plus per-account restriction controls. */
export function UserSecurityPanel() {
  const fetchDirectory = useServerFn(getUserSecurityDirectory);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "restricted" | "suspended">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const directory = useQuery({
    queryKey: ["admin-user-security"],
    queryFn: () => fetchDirectory(),
    refetchInterval: 30_000,
  });

  const rows: Row[] = directory.data ?? [];

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "restricted" && !(r.tradingFrozen || r.withdrawalsDisabled || r.accountFrozen))
        return false;
      if (filter === "suspended" && r.suspensionStatus === "active") return false;
      if (!q) return true;
      return [r.displayName, r.email, r.uid].filter(Boolean).some((v) =>
        String(v).toLowerCase().includes(q),
      );
    });
  }, [rows, term, filter]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, email or UID"
            className="w-full rounded-lg border border-input bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-ring"
          />
        </div>
        {(["all", "restricted", "suspended"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`touch-manipulation rounded-full border px-3 py-1.5 text-xs font-semibold capitalize ${
              filter === f
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-left">Registered</th>
              <th className="px-3 py-2 text-left">KYC</th>
              <th className="px-3 py-2 text-left">Trading</th>
              <th className="px-3 py-2 text-left">Withdrawals</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {directory.isLoading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  Loading accounts…
                </td>
              </tr>
            )}
            {!directory.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No accounts match this view.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border/70 hover:bg-muted/30">
                <td className="px-3 py-2">
                  <p className="font-semibold">{r.displayName}</p>
                  <p className="text-[11px] text-muted-foreground">{r.uid ?? r.id.slice(0, 8)}</p>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.email ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
                <td className="px-3 py-2">
                  <Pill tone={kycTone(r.kycStatus)}>{r.kycStatus}</Pill>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={r.tradingFrozen ? "bad" : "ok"}>
                    {r.tradingFrozen ? "Disabled" : "Enabled"}
                  </Pill>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={r.withdrawalsDisabled ? "bad" : "ok"}>
                    {r.withdrawalsDisabled ? "Frozen" : "Active"}
                  </Pill>
                </td>
                <td className="px-3 py-2">
                  <Pill
                    tone={
                      r.suspensionStatus === "permanently_banned"
                        ? "bad"
                        : r.suspensionStatus !== "active" || r.accountFrozen
                          ? "warn"
                          : "ok"
                    }
                  >
                    {r.suspensionStatus === "permanently_banned"
                      ? "Banned"
                      : r.suspensionStatus === "suspended"
                        ? "Suspended"
                        : r.accountFrozen
                          ? "Frozen"
                          : "Active"}
                  </Pill>
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className="touch-manipulation rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"
                  >
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div className="rounded-xl border border-ops-red/30 bg-card p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ops-red">
                <ShieldAlert className="size-3" /> Account restrictions
              </p>
              <p className="text-sm font-semibold">
                {selected.displayName}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {selected.email ?? selected.id.slice(0, 8)}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="touch-manipulation rounded-lg border border-border p-1.5 text-muted-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>
          </div>

          <UserAccountControls
            userId={selected.id}
            tradingFrozen={selected.tradingFrozen}
            withdrawalsDisabled={selected.withdrawalsDisabled}
            accountFrozen={selected.accountFrozen}
            suspensionStatus={selected.suspensionStatus}
            suspendedUntil={selected.suspendedUntil}
            suspensionReason={selected.suspensionReason}
            onChanged={() => void directory.refetch()}
          />

          <div className="mt-3">
            <AccountMaintenancePanel
              userId={selected.id}
              userName={(selected as any).displayName ?? (selected as any).display_name ?? null}
              onDone={() => void directory.refetch()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
