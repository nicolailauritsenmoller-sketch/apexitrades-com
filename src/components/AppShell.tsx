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
  UserRound,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { NotificationBell } from "@/components/NotificationBell";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { ThemeToggle } from "@/lib/theme";
import { SiteFooter } from "@/components/SiteFooter";
import { UserAvatar } from "@/components/UserAvatar";
import { InstallAppButton } from "@/components/PwaInstall";

import brandLogo from "@/assets/velocity-trade-logo.png";
import { getMyAccess } from "@/lib/admin.functions";
import { usePresenceHeartbeat } from "@/lib/use-presence";

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
  usePresenceHeartbeat();

  const fetchAccess = useServerFn(getMyAccess);
  const access = useQuery({
    queryKey: ["my-access"],
    queryFn: () => fetchAccess(),
    retry: false,
    staleTime: 60_000,
  });
  const isStaff = Boolean(access.data?.isStaff);
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <AnnouncementBanner />
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto grid h-14 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:flex md:gap-6">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <img
              src={brandLogo}
              alt="Velocity Trade logo"
              width={1024}
              height={1024}
              className="size-9 shrink-0 object-contain"
            />
            <span className="truncate font-display text-sm font-bold tracking-tight">
              VELOCITY TRADE
            </span>
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
            {isStaff ? (
              <Link
                to="/sys-portal-x97"
                className="hidden touch-manipulation items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 sm:flex"
              >
                <ShieldCheck className="size-4" />
                Admin Panel
              </Link>
            ) : null}
            <InstallAppButton />
            <ThemeToggle />
            <NotificationBell />
            <span className="hidden items-center gap-2 rounded-full border border-border px-3 py-1 text-[11px] uppercase tracking-widest text-muted-foreground sm:flex">
              <span className="live-dot size-1.5 rounded-full bg-bull" />
              Live account
            </span>
            <Link to="/profile" aria-label="Profile" className="touch-manipulation">
              <UserAvatar className="size-8" alt="Your profile avatar" />
            </Link>
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

      <main className="mx-auto w-full max-w-[1600px] overflow-x-hidden overflow-y-auto px-3 py-4 pb-28 sm:px-4 sm:py-6 md:pb-6">
        {children}
      </main>

      <div className="pb-24 md:pb-0">
        <SiteFooter />
      </div>

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

    </div>
  );
}
