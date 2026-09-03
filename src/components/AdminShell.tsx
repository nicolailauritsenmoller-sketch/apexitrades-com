import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ThemeToggle } from "@/lib/theme";
import { AdminAlerts } from "@/components/admin/AdminAlerts";

/**
 * Standalone backend layout. Deliberately shares no chrome with the customer
 * app: no marketing header, no user navigation, no footer, no chat widget.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-3 px-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
            <ShieldCheck className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-tight">
              Operations Console
            </p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              Restricted — authorised staff only
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <AdminAlerts />
            <ThemeToggle />

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

      <main className="mx-auto w-full max-w-[1600px] overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
        {children}
      </main>
    </div>
  );
}
