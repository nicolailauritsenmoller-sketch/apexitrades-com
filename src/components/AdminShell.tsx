import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminAlerts } from "@/components/admin/AdminAlerts";
import { AdminSearch } from "@/components/admin/AdminSearch";

/**
 * Standalone backend layout. Deliberately shares no chrome with the customer
 * app: no marketing header, no user navigation, no footer, no chat widget.
 */
export function AdminShell({ children, independentPanes = false }: { children: ReactNode; independentPanes?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-background">
      <header className="z-40 shrink-0 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">
              Operations Console
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Restricted - authorised staff only
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AdminSearch />
            <AdminAlerts />
            <button
              onClick={signOut}
              className="flex touch-manipulation items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className={`mx-auto min-h-0 w-full max-w-[1600px] flex-1 overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6 ${independentPanes ? "overflow-y-hidden" : "overflow-y-auto overscroll-contain"}`}>
        {children}
      </main>
    </div>
  );
}
