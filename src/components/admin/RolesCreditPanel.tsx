import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Search, ShieldCheck, Loader2 } from "lucide-react";
import { getUserDirectory, setUserCreditScore, setUserRole } from "@/lib/admin.functions";
import { CREDIT_SCORE_MAX, CREDIT_SCORE_MIN, creditScoreBand } from "@/lib/limits";
import { downloadCsv } from "@/lib/csv";

type DirectoryUser = {
  id: string;
  displayName: string;
  uid: string | null;
  creditScore: number;
  createdAt: string;
  roles: string[];
  isAdmin: boolean;
  kycStatus: string;
  legalName: string | null;
  wallets: { currency: string; balance: number }[];
};

function useDirectory() {
  const fetchDirectory = useServerFn(getUserDirectory);
  return useQuery({
    queryKey: ["admin-user-directory"],
    queryFn: () => fetchDirectory() as Promise<DirectoryUser[]>,
    refetchInterval: 60_000,
  });
}

function exportUsers(rows: DirectoryUser[]) {
  const ok = downloadCsv(
    `users-${new Date().toISOString().slice(0, 10)}`,
    rows.map((u) => ({
      user_id: u.id,
      uid: u.uid ?? "",
      display_name: u.displayName,
      legal_name: u.legalName ?? "",
      roles: u.roles.join("|"),
      credit_score: u.creditScore,
      kyc_status: u.kycStatus,
      created_at: u.createdAt,
      balances: u.wallets.map((w) => `${w.currency}:${w.balance}`).join("|"),
    })),
  );
  if (!ok) toast.error("Nothing to export.");
}

export function ExportButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
    >
      <Download className="size-3.5" />
      {label}
    </button>
  );
}

export function RolesPanel() {
  const qc = useQueryClient();
  const directory = useDirectory();
  const [term, setTerm] = useState("");
  const grantRole = useServerFn(setUserRole);

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "agent"; grant: boolean }) =>
      grantRole({ data: vars }),
    onSuccess: () => {
      toast.success("Permissions updated.");
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = directory.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      [u.displayName, u.legalName ?? "", u.uid ?? "", u.id].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [directory.data, term]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-semibold tracking-tight">Users &amp; roles</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search users"
              className="w-44 rounded-md bg-secondary py-1.5 pl-7 pr-2 text-xs outline-none"
            />
          </div>
          <ExportButton onClick={() => exportUsers(rows)} label="Export CSV" />
        </div>
      </header>

      <div className="max-h-[70vh] overflow-auto">
        {directory.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading directory…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users match that search.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">User</th>
                <th className="px-4 py-2 text-left">KYC</th>
                <th className="px-4 py-2 text-left">Credit</th>
                <th className="px-4 py-2 text-left">Roles</th>
                <th className="px-4 py-2 text-right">Permissions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-border/60">
                  <td className="px-4 py-2">
                    <div className="font-medium">{u.legalName ?? u.displayName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">
                      {u.uid ?? u.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs capitalize text-muted-foreground">
                    {u.kycStatus}
                  </td>
                  <td className="px-4 py-2 num text-xs">{u.creditScore}</td>
                  <td className="px-4 py-2 text-xs capitalize text-muted-foreground">
                    {u.roles.join(", ")}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      {(["admin", "agent"] as const).map((role) => {
                        const has = u.roles.includes(role);
                        return (
                          <button
                            key={role}
                            disabled={mutation.isPending}
                            onClick={() =>
                              mutation.mutate({ userId: u.id, role, grant: !has })
                            }
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] capitalize transition-colors disabled:opacity-50 ${
                              has
                                ? "border-primary/40 bg-primary/15 text-primary"
                                : "border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <ShieldCheck className="size-3" />
                            {has ? `Revoke ${role}` : `Grant ${role}`}
                          </button>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

export function CreditScorePanel() {
  const qc = useQueryClient();
  const directory = useDirectory();
  const [term, setTerm] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const update = useServerFn(setUserCreditScore);

  const mutation = useMutation({
    mutationFn: (vars: { userId: string; score: number; note?: string }) =>
      update({ data: vars }),
    onSuccess: () => {
      toast.success("Credit score updated.");
      qc.invalidateQueries({ queryKey: ["admin-user-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = directory.data ?? [];
    const q = term.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) =>
      [u.displayName, u.legalName ?? "", u.uid ?? "", u.id].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [directory.data, term]);

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Credit score management
          </h2>
          <p className="text-xs text-muted-foreground">
            Range {CREDIT_SCORE_MIN}–{CREDIT_SCORE_MAX}. Scores below 500 block withdrawals.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search users"
            className="w-44 rounded-md bg-secondary py-1.5 pl-7 pr-2 text-xs outline-none"
          />
        </div>
      </header>

      <div className="max-h-[70vh] divide-y divide-border/60 overflow-auto">
        {directory.isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading users…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No users match that search.</p>
        ) : (
          rows.map((u) => {
            const band = creditScoreBand(u.creditScore);
            const draft = drafts[u.id] ?? String(u.creditScore);
            return (
              <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-40 flex-1">
                  <div className="text-sm font-medium">{u.legalName ?? u.displayName}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {u.uid ?? u.id.slice(0, 8)}
                  </div>
                </div>
                <div className={`w-28 text-sm font-semibold ${band.tone}`}>
                  {u.creditScore} · {band.label}
                </div>
                <input
                  type="number"
                  min={CREDIT_SCORE_MIN}
                  max={CREDIT_SCORE_MAX}
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [u.id]: e.target.value }))}
                  className="w-24 rounded-md bg-secondary px-2 py-1.5 text-sm outline-none"
                />
                <input
                  value={notes[u.id] ?? ""}
                  onChange={(e) => setNotes((n) => ({ ...n, [u.id]: e.target.value }))}
                  placeholder="Reason (optional)"
                  maxLength={300}
                  className="w-48 rounded-md bg-secondary px-2 py-1.5 text-xs outline-none"
                />
                <button
                  disabled={mutation.isPending}
                  onClick={() => {
                    const score = Number(draft);
                    if (
                      !Number.isFinite(score) ||
                      score < CREDIT_SCORE_MIN ||
                      score > CREDIT_SCORE_MAX
                    ) {
                      toast.error(`Score must be ${CREDIT_SCORE_MIN}–${CREDIT_SCORE_MAX}.`);
                      return;
                    }
                    mutation.mutate({
                      userId: u.id,
                      score: Math.round(score),
                      note: notes[u.id]?.trim() || undefined,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {mutation.isPending && <Loader2 className="size-3 animate-spin" />}
                  Save
                </button>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
