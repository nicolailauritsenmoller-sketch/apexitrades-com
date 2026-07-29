import { Link, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LineChart, LayoutDashboard, Compass, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/dashboard", params: {}, label: "Portfolio", icon: LayoutDashboard },
  { to: "/markets", params: {}, label: "Markets", icon: Compass },
  { to: "/terminal/$symbol", params: { symbol: "BTCUSDT" }, label: "Terminal", icon: LineChart },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="size-4" strokeWidth={2.6} />
            </span>
            <span className="font-display text-sm font-bold tracking-tight">VELOCITY</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map(({ to, params, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                params={params}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground sm:flex">
              <span className="live-dot size-1.5 rounded-full bg-bull" />
              Paper account
            </span>
            <button
              onClick={signOut}
              className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  );
}
