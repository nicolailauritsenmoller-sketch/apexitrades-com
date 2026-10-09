import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { TraderLiveSync } from "@/components/security/TraderLiveSync";
import { AccountSuspended } from "@/components/AccountSuspended";
import { TwoFactorChallenge } from "@/components/security/TwoFactorChallenge";
import { getMyAccountStatus, type AccountLockState } from "@/lib/account-status.functions";
import { getTwoFactorState, type TwoFactorState } from "@/lib/two-factor.functions";

export function AuthenticatedGate({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        try { sessionStorage.setItem("post_login_path", window.location.pathname + window.location.search); } catch {}
        navigate({ to: "/auth", replace: true });
        return;
      }
      setStatus("authed");
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const fetchStatus = useServerFn(getMyAccountStatus);
  const lock = useQuery({
    queryKey: ["my-account-status"],
    queryFn: () => fetchStatus() as Promise<AccountLockState>,
    enabled: status === "authed",
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  // 2FA gate: re-evaluated server-side on every load, so direct URLs cannot bypass it.
  const fetchTwoFactor = useServerFn(getTwoFactorState);
  const twoFactor = useQuery({
    queryKey: ["two-factor-state"],
    queryFn: () => fetchTwoFactor() as Promise<TwoFactorState>,
    enabled: status === "authed",
    retry: false,
    staleTime: 30_000,
  });

  if (
    status === "checking" ||
    (status === "authed" && (lock.isLoading || twoFactor.isLoading))
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (lock.isError || twoFactor.isError) return <div role="alert" className="p-8 text-muted-foreground">Security verification unavailable. Reload to try again.</div>;

  if (lock.data?.locked) return <AccountSuspended state={lock.data} />;

  if (twoFactor.data && twoFactor.data.enabled && !twoFactor.data.sessionVerified) {
    return (
      <TwoFactorChallenge
        onVerified={() => void queryClient.invalidateQueries({ queryKey: ["two-factor-state"] })}
      />
    );
  }

  const notices = [
    lock.data?.tradingFrozen && "Trading is frozen on this account.",
    lock.data?.verificationRequired && "Additional verification is required before trading.",
    lock.data?.marginRestricted && "Margin trading is restricted - 1× leverage only.",
  ].filter(Boolean) as string[];

  return (
    <>
      {notices.length > 0 && (
        <div role="alert" className="sticky top-0 z-[60] bg-destructive px-4 py-2.5 text-center text-sm font-semibold text-destructive-foreground">
          {notices.join(" · ")}
        </div>
      )}
      <TraderLiveSync />
      {children}
    </>
  );
}
