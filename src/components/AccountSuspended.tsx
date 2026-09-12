import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LifeBuoy, LogOut, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LiveChatDialog } from "@/components/support/LiveChatDialog";
import type { AccountLockState } from "@/lib/account-status.functions";

function useCountdown(until: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [until]);
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return "Lifting now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

/** Full-screen lock shown instead of the app whenever an account is restricted. */
export function AccountSuspended({ state }: { state: AccountLockState }) {
  const navigate = useNavigate();
  const countdown = useCountdown(state.until);
  const banned = state.status === "permanently_banned";

  const badge = banned
    ? "Account Permanently Closed"
    : state.frozen && state.status === "active"
      ? "Account Frozen"
      : "Account Temporarily Suspended";

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen touch-manipulation items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-ops-red/40 bg-ops-red/10">
          <ShieldAlert className="size-7 text-ops-red" />
        </div>

        <span className="mt-4 inline-block rounded-full border border-ops-red/40 bg-ops-red/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-ops-red">
          {badge}
        </span>

        <h1 className="mt-3 font-display text-xl font-bold tracking-tight">
          Access to your account is restricted
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {state.reason ?? "Your account is under an active security review."}
        </p>
        {state.note ? (
          <p className="mt-2 rounded-xl border border-border bg-background/60 p-3 text-xs text-muted-foreground">
            {state.note}
          </p>
        ) : null}

        {!banned && (
          <div className="mt-4 rounded-xl border border-border bg-background/60 p-4">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {state.until ? "Suspension lifts in" : "Status"}
            </p>
            <p className="num mt-1 text-lg font-bold">{countdown ?? "Under active review"}</p>
            {state.until ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {new Date(state.until).toLocaleString()}
              </p>
            ) : null}
          </div>
        )}

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("velocity:open-chat"))}
          className="mt-5 flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground"
        >
          <LifeBuoy className="size-4" /> Contact security support
        </button>

        <button
          onClick={() => void signOut()}
          className="mt-2 flex w-full touch-manipulation items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-muted-foreground"
        >
          <LogOut className="size-4" /> Sign out
        </button>
      </div>

      <LiveChatDialog />
    </div>
  );
}
