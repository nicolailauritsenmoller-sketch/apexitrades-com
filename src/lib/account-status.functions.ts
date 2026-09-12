import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccountLockState = {
  locked: boolean;
  status: "active" | "suspended" | "permanently_banned";
  reason: string | null;
  note: string | null;
  until: string | null;
  frozen: boolean;
  tradingFrozen: boolean;
  withdrawalsDisabled: boolean;
};

/** Shared shape used by the suspension screen and by every server-side guard. */
export function deriveLockState(profile: any): AccountLockState {
  const status = (profile?.suspension_status ?? "active") as AccountLockState["status"];
  const until = (profile?.suspended_until ?? null) as string | null;
  const expired = status === "suspended" && until ? new Date(until).getTime() <= Date.now() : false;
  const frozen = Boolean(profile?.account_frozen);
  const effectiveStatus = expired ? "active" : status;
  return {
    locked: frozen || effectiveStatus === "suspended" || effectiveStatus === "permanently_banned",
    status: effectiveStatus,
    reason: (profile?.suspension_reason ?? null) as string | null,
    note: (profile?.suspension_note ?? null) as string | null,
    until: expired ? null : until,
    frozen,
    tradingFrozen: Boolean(profile?.trading_frozen),
    withdrawalsDisabled: Boolean(profile?.withdrawals_disabled),
  };
}

const SELECT =
  "account_frozen,suspension_status,suspension_reason,suspension_note,suspended_until,trading_frozen,withdrawals_disabled";

/** Current restriction state for the signed-in account. */
export const getMyAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select(SELECT)
      .eq("id", context.userId)
      .maybeSingle();
    return deriveLockState(data);
  });

/** Server guard: throws when the account is locked out of the platform. */
export async function assertAccountUsable(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select(SELECT).eq("id", userId).maybeSingle();
  const state = deriveLockState(data);
  if (state.status === "permanently_banned") {
    throw new Error("This account has been permanently closed. Contact security support.");
  }
  if (state.locked) {
    throw new Error("Your account is currently suspended. Contact security support.");
  }
  return state;
}
