import { Link, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LineChart,
  LayoutDashboard,
  Compass,
  LogOut,
  Home,
  Wallet,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMyAccess } from "@/lib/admin.functions";
import { NotificationBell } from "@/components/NotificationBell";
import { ChatWidget } from "@/components/ChatWidget";
import { ThemeToggle } from "@/lib/theme";


const NAV = [
  { to: "/", params: {}, label: "Home", icon: Home, exact: true },
  { to: "/dashboard", params: {}, label: "Portfolio", icon: LayoutDashboard, exact: false },
  { to: "/markets", params: {}, label: "Market", icon: Compass, exact: false },
  {
    to: "/terminal/$symbol",
    params: { symbol: "BTCUSDT" },
    label: "Trade",
    icon: LineChart,
    exact: false,
  },
  { to: "/wallet", params: {}, label: "Wallet", icon: Wallet, exact: false },
  { to: "/profile", params: {}, label: "Profile", icon: UserRound, exact: false },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const fetchAccess = useServerFn(getMyAccess);
  const access = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = access.data?.isAdmin === true;

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }


  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:flex md:gap-6">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
              <LineChart className="size-4" strokeWidth={2.6} />
            </span>
            <span className="truncate font-display text-sm font-bold tracking-tight">VELOCITY</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, params, label, icon: Icon, exact }) => (
              <Link
                key={to}
                to={to}
                params={params}
                activeOptions={{ exact }}
                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 md:ml-auto">
            {isAdmin && (
              <Link
                to="/admin"
                className="flex items-center gap-2 rounded-md border border-primary/40 px-3 py-1.5 text-sm text-primary transition-colors hover:bg-primary/10"
                activeProps={{ className: "bg-primary/10" }}
              >
                <ShieldCheck className="size-4" />
                <span className="hidden sm:inline">Admin Panel</span>
              </Link>
            )}

            <ThemeToggle />
            <NotificationBell />
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground sm:flex">
              <span className="live-dot size-1.5 rounded-full bg-bull" />
              Paper account
            </span>
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

      <main className="mx-auto max-w-[1600px] touch-manipulation px-3 py-4 pb-28 sm:px-4 sm:py-6 md:pb-6">
        {children}
      </main>

      {/* Mobile taskbar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="mx-auto grid max-w-lg grid-cols-6">
          {NAV.map(({ to, params, label, icon: Icon, exact }) => (
            <li key={to}>
              <Link
                to={to}
                params={params}
                activeOptions={{ exact }}
                className="flex min-h-[56px] touch-manipulation flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors active:bg-secondary/60"
                activeProps={{ className: "text-primary" }}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <ChatWidget />
    </div>
  );
}
