import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins, Eye, X } from "lucide-react";
import { BalanceAdjustDialog } from "@/components/admin/BalanceAdjustDialog";
import { UserAccountControls } from "@/components/admin/UserAccountControls";
import { AccountMaintenancePanel } from "@/components/admin/AccountMaintenancePanel";
import { VipMembershipPanel } from "@/components/admin/VipMembershipPanel";
import { CompliancePanel } from "@/components/admin/CompliancePanel";
import { UserVipFeesPanel } from "@/components/admin/UserVipFeesPanel";

import { getUserWorkspace } from "@/lib/admin.functions";
import { AssetIcon } from "@/lib/asset-icons";
import { UidTag } from "@/components/VerifiedBadge";
import { supabase } from "@/integrations/supabase/client";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border/70 bg-card/60 p-3 backdrop-blur">
      <h4 className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</h4>
      {children}
    </section>
  );
}

const num = (n: unknown) =>
  Number(n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 6 });

function RecentAudit({ userId }: { userId: string }) {
  const q = useQuery({
    queryKey: ["admin-user-audit", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_logs")
        .select("id,action,actor_name,created_at")
        .eq("target_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });
  const rows = q.data ?? [];
  if (!rows.length) return <p className="text-xs text-muted-foreground">No audit entries.</p>;
  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map((r) => (
        <li key={r.id} className="flex justify-between gap-2">
          <span className="truncate font-mono">{r.action}<span className="text-muted-foreground"> · {r.actor_name ?? "Staff"}</span></span>
          <span className="num shrink-0 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}

/** Read-only support view of a user's workspace: balances, trades and activity. */
export function UserWorkspaceDrawer({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const fetchWorkspace = useServerFn(getUserWorkspace);
  const q = useQuery({
    queryKey: ["admin-user-workspace", userId],
    queryFn: () => fetchWorkspace({ data: { userId } }),
  });
  const d = q.data as any;

  return (
    <div className="fixed inset-0 z-[110] flex justify-end bg-black/60 backdrop-blur-sm">
      <button aria-label="Close" className="flex-1" onClick={onClose} />
      <aside className="flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-2xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Eye className="size-4 text-primary" />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">
              Inspect user workspace
            </p>
            <p className="text-[11px] text-muted-foreground">Read-only support view</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto touch-manipulation rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {q.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading workspace…</p>}
          {q.isError && (
            <p className="p-4 text-sm text-ops-red">{(q.error as Error)?.message ?? "Failed."}</p>
          )}
          {d && (
            <>
              <Section title="Identity">
                <p className="text-sm font-semibold">{d.profile?.display_name ?? "-"}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  <UidTag uid={d.profile?.uid} /> · base {d.profile?.base_currency ?? "-"} · credit{" "}
                  {d.profile?.credit_score ?? "-"}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  KYC: {d.kyc?.status ?? "not submitted"}
                  {d.kyc?.country ? ` · ${d.kyc.country}` : ""}
                </p>
              </Section>

              <Section title="Compliance risk & overrides">
                <CompliancePanel userId={userId} />
              </Section>

              <Section title="VIP tier, fees & account manager">
                <UserVipFeesPanel userId={userId} />
              </Section>

              <Section title="Account controls">
                <UserAccountControls
                  userId={userId}
                  tradingFrozen={Boolean(d.profile?.trading_frozen)}
                  withdrawalsDisabled={Boolean(d.profile?.withdrawals_disabled)}
                  accountFrozen={Boolean(d.profile?.account_frozen)}
                  suspensionStatus={d.profile?.suspension_status ?? "active"}
                  suspendedUntil={d.profile?.suspended_until ?? null}
                  suspensionReason={d.profile?.suspension_reason ?? null}
                  onChanged={() => void q.refetch()}
                />
              </Section>


              <Section title="VIP membership">
                <VipMembershipPanel
                  userId={userId}
                  userName={d.profile?.display_name}
                  vipTier={d.profile?.vip_tier}
                  onChanged={() => void q.refetch()}
                />
              </Section>

              <Section title="Account maintenance">
                <AccountMaintenancePanel
                  userId={userId}
                  userName={d.profile?.display_name}
                  onDone={() => void q.refetch()}
                />
              </Section>

              <Section title="Balances">
                <button
                  onClick={() => setAdjusting(true)}
                  className="mb-2 flex w-full touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary"
                >
                  <Coins className="size-3.5" /> Credit / debit balance
                </button>
                <ul className="grid grid-cols-2 gap-2">
                  {d.wallets.map((w: any) => (
                    <li
                      key={w.currency}
                      className="flex items-center gap-2 rounded-lg border border-border/70 p-2"
                    >
                      <AssetIcon symbol={w.currency} className="size-5" />
                      <span className="text-xs text-muted-foreground">{w.currency}</span>
                      <span className="num ml-auto text-xs font-semibold">{num(w.balance)}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section title="Recent contracts">
                {d.contracts.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No contracts.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {d.contracts.map((c: any) => (
                      <li key={c.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {c.display_symbol} · {c.direction}
                        </span>
                        <span className="num shrink-0 text-muted-foreground">
                          {num(c.stake)} {c.currency} · {c.result ?? c.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Open / recent positions">
                {d.positions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No positions.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs">
                    {d.positions.map((p: any) => (
                      <li key={p.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {p.display_symbol} · {p.side} ×{num(p.leverage)}
                        </span>
                        <span className="num shrink-0 text-muted-foreground">
                          {num(p.quantity)} @ {num(p.entry_price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Funding history">
                <ul className="space-y-1.5 text-xs">
                  {[...d.deposits.map((x: any) => ({ ...x, kind: "deposit" })), ...d.withdrawals.map((x: any) => ({ ...x, kind: "withdrawal" }))]
                    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
                    .slice(0, 20)
                    .map((r: any) => (
                      <li key={`${r.kind}-${r.id}`} className="flex items-center justify-between gap-2">
                        <span className="capitalize">
                          {r.kind} · {num(r.amount)} {r.coin}
                        </span>
                        <span className="shrink-0 text-muted-foreground">{r.status}</span>
                      </li>
                    ))}
                  {d.deposits.length + d.withdrawals.length === 0 && (
                    <p className="text-xs text-muted-foreground">No funding activity.</p>
                  )}
                </ul>
              </Section>

              <Section title="Devices & logins">
                <ul className="space-y-1.5 text-xs">
                  {d.sessions.map((s: any, i: number) => (
                    <li key={i} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {s.browser} · {s.os} · {s.country ?? "-"}
                      </span>
                      <span className="num shrink-0 text-muted-foreground">
                        {s.ip_address ?? "-"}
                      </span>
                    </li>
                  ))}
                  {d.sessions.length === 0 && (
                    <p className="text-xs text-muted-foreground">No sessions recorded.</p>
                  )}
                </ul>
              </Section>

              <Section title="Recent audit log">
                <RecentAudit userId={userId} />
              </Section>
            </>
          )}
        </div>
      </aside>
      {adjusting && (
        <BalanceAdjustDialog
          userId={userId}
          userName={d?.profile?.display_name}
          onClose={() => setAdjusting(false)}
        />
      )}
    </div>
  );
}
