import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Globe2 } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { CommunityDeskPanel } from "@/components/admin/CommunityDeskPanel";
import { getMyAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/community")({
  head: () => ({ meta: [
    { title: "Operations Console - Community Desk | Velocity Trade" },
    { name: "description", content: "Manage official community channels, public bulletins and VIP lounge access requests." },
    { property: "og:title", content: "Operations Console - Community Desk | Velocity Trade" },
    { property: "og:url", content: "https://veloxitrade-com.lovable.app/admin/community" },
    { property: "og:description", content: "Restricted community operations and access management." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex, nofollow" },
  ], links: [{ rel: "canonical", href: "https://veloxitrade-com.lovable.app/admin/community" }] }),
  component: CommunityDeskRoute,
});

function CommunityDeskRoute() {
  const fetchAccess = useServerFn(getMyAccess);
  const access = useQuery({ queryKey: ["my-access"], queryFn: () => fetchAccess(), retry: false });
  if (access.isLoading) return <AdminShell><p className="p-8 text-sm text-muted-foreground">Checking access…</p></AdminShell>;
  if (!access.data?.isAdmin) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">This page could not be found.</div>;
  return <AdminShell><div className="space-y-4"><header className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div><Link to="/sys-portal-x97" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><ChevronLeft className="size-3.5" />Control Center</Link><div className="mt-2 flex items-center gap-2"><Globe2 className="size-5 text-ops-emerald" /><h1 className="text-xl font-bold">Community Management Desk</h1></div><p className="mt-1 text-xs text-muted-foreground">Official channels, landing bulletins and private VIP community approvals.</p></div></header><CommunityDeskPanel /></div></AdminShell>;
}