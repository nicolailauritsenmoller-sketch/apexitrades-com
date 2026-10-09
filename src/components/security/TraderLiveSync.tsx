import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { getMyAccountStatus, deriveLockState, type AccountLockState } from "@/lib/account-status.functions";

export const LOCK_NOTICE_KEY = "vt.lock-notice";

/** Shared, cached account restriction state (same query the auth gate uses). */
export function useAccountLock() {
  const fetchStatus = useServerFn(getMyAccountStatus);
  return useQuery({
    queryKey: ["my-account-status"],
    queryFn: () => fetchStatus() as Promise<AccountLockState>,
    retry: false,
    staleTime: 30_000,
  });
}

async function latestAdminMessage(uid: string): Promise<string | null> {
  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { data } = await supabase
    .from("notifications")
    .select("title,body")
    .eq("user_id", uid)
    .eq("kind", "warning")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? `${data.title}: ${data.body}` : null;
}

const WALLET_KEYS = ["wallet-activity", "portfolio-value", "portfolio", "daily-pnl", "wallets", "balances", "assets"];

/**
 * Live bridge between Operations Console actions and the trader UI:
 * restrictions, deposit clearing, contract settlements and broadcasts.
 */
export function TraderLiveSync() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [overlay, setOverlay] = useState<{ title: string; message: string } | null>(null);
  const prev = useRef<AccountLockState | null>(null);
  const credited = useRef(new Set<string>());

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    void supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id;
      if (!uid || cancelled) return;
      const refreshWallet = () => WALLET_KEYS.forEach((k) => void qc.invalidateQueries({ queryKey: [k] }));

      channel = supabase
        .channel(`trader-live-${uid}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${uid}` }, async (payload) => {
          const next = deriveLockState(payload.new);
          const before = prev.current;
          prev.current = next;
          void qc.invalidateQueries({ queryKey: ["my-account-status"] });
          void qc.invalidateQueries({ queryKey: ["profile-overview"] });

          if (next.locked && !before?.locked) {
            // Revoke the local session immediately; server-side sessions are ended by the desk.
            const msg = next.note ?? next.reason ?? "Your account has been locked by the operations desk.";
            try { sessionStorage.setItem(LOCK_NOTICE_KEY, msg); } catch {}
            await supabase.auth.signOut({ scope: "local" });
            navigate({ to: "/auth", replace: true });
            return;
          }
          const added: string[] = [];
          if (next.tradingFrozen && !before?.tradingFrozen) added.push("Trading has been frozen");
          if (next.marginRestricted && !before?.marginRestricted) added.push("Margin trading has been restricted to 1x leverage");
          if (next.withdrawalsDisabled && !before?.withdrawalsDisabled) added.push("Withdrawals have been disabled");
          if (added.length) {
            await new Promise((r) => setTimeout(r, 600)); // allow the desk's notification to land
            const message = (await latestAdminMessage(uid)) ?? `${added.join(". ")} on your account.`;
            setOverlay({ title: "Account restriction applied", message });
          }
        })
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "deposits", filter: `user_id=eq.${uid}` }, (payload) => {
          const d = payload.new as any;
          refreshWallet();
          if (d?.status === "approved" && !credited.current.has(d.id)) {
            credited.current.add(d.id);
            toast.success(`Deposit of ${Number(d.amount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${d.coin} Cleared & Credited`, { duration: 8000 });
          }
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${uid}` }, refreshWallet)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "contracts", filter: `user_id=eq.${uid}` }, () => {
          for (const k of ["contracts", "positions", "open-contracts", "daily-pnl", "portfolio"]) void qc.invalidateQueries({ queryKey: [k] });
          refreshWallet();
        })
        .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, () => {
          void qc.invalidateQueries({ queryKey: ["announcements-active"] });
        })
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, (payload) => {
          const n = payload.new as any;
          void qc.invalidateQueries({ queryKey: ["announcements-active"] });
          void qc.invalidateQueries({ queryKey: ["notifications"] });
          if (n?.broadcast_id) toast(n.title, { description: n.body, duration: 8000 });
        })
        .subscribe();
    });
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [qc, navigate]);

  if (!overlay) return null;
  return (
    <div role="alertdialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-destructive/50 bg-card p-6 shadow-2xl">
        <div className="flex items-center gap-2 text-destructive"><ShieldAlert className="size-5" /><h2 className="text-base font-bold">{overlay.title}</h2></div>
        <p className="mt-3 text-sm text-foreground">{overlay.message}</p>
        <p className="mt-2 text-xs text-muted-foreground">Restricted actions are blocked until the operations desk lifts this control.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setOverlay(null); navigate({ to: "/profile/support" }); }}>Contact support</Button>
          <Button onClick={() => setOverlay(null)}>Acknowledge</Button>
        </div>
      </div>
    </div>
  );
}

/** Blocks a form (trade ticket, withdrawal) while the matching restriction is active. */
export function RestrictionBlock({ kind, children }: { kind: "trading" | "withdrawals"; children: React.ReactNode }) {
  const lock = useAccountLock();
  const blocked = kind === "trading" ? lock.data?.tradingFrozen : lock.data?.withdrawalsDisabled;
  if (!blocked) return <>{children}</>;
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none opacity-30 blur-[1px]">{children}</div>
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="max-w-xs rounded-lg border border-destructive/50 bg-card p-4 text-center shadow-lg">
          <ShieldAlert className="mx-auto size-5 text-destructive" />
          <p className="mt-2 text-sm font-semibold">{kind === "trading" ? "Trading is frozen on this account" : "Withdrawals are disabled on this account"}</p>
          <p className="mt-1 text-xs text-muted-foreground">{lock.data?.note ?? "Contact support for details."}</p>
        </div>
      </div>
    </div>
  );
}
