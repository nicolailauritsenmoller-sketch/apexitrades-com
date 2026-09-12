import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AccountSuspended } from "@/components/AccountSuspended";
import { getMyAccountStatus, type AccountLockState } from "@/lib/account-status.functions";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "authed">("checking");

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
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

  if (status === "checking" || (status === "authed" && lock.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (lock.data?.locked) return <AccountSuspended state={lock.data} />;

  return <Outlet />;
}
