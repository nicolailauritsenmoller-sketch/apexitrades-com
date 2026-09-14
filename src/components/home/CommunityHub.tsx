import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, CalendarDays, Crown, Gift, Globe2, LockKeyhole, MessageCircle, Radio, ShieldAlert, Twitter, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { requestCommunityVipAccess } from "@/lib/community.functions";
import { getProfileOverview } from "@/lib/profile.functions";
import { isVip } from "@/lib/vip-tiers";

const ICONS = { telegram: Radio, discord: MessageCircle, x: Twitter, vip: Crown } as const;

export function CommunityHub({ authed }: { authed: boolean }) {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getProfileOverview);
  const requestAccess = useServerFn(requestCommunityVipAccess);
  const channels = useQuery({ queryKey: ["community-public-channels"], queryFn: async () => {
    const { data, error } = await supabase.from("community_channels").select("*").order("sort_order");
    if (error) throw error;
    return data ?? [];
  }});
  const bulletins = useQuery({ queryKey: ["community-public-announcements"], queryFn: async () => {
    const { data, error } = await supabase.from("community_announcements").select("*").eq("status", "published").order("created_at", { ascending: false }).limit(4);
    if (error) throw error;
    return data ?? [];
  }});
  const profile = useQuery({ queryKey: ["profile-overview"], queryFn: () => fetchProfile(), enabled: authed });
  const vip = isVip(profile.data?.profile?.vipTier);
  const requestMutation = useMutation({
    mutationFn: () => requestAccess({ data: {} }),
    onSuccess: () => toast.success("VIP Lounge access request submitted"),
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const channel = supabase.channel("community-public-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_channels" }, () => void qc.invalidateQueries({ queryKey: ["community-public-channels"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "community_announcements" }, () => void qc.invalidateQueries({ queryKey: ["community-public-announcements"] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  return (
    <section className="relative z-10 border-y border-border bg-surface/70">
      <div className="mx-auto w-full max-w-6xl px-4 py-16">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase text-primary">Official Community Network</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Join the Global Trading Desk Community</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Connect with institutional traders, access real-time market signals, and engage in VIP desk discussions across official channels.</p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(channels.data ?? []).map((item) => {
            const Icon = ICONS[item.channel_key as keyof typeof ICONS] ?? Globe2;
            const active = item.status === "active" && Boolean(item.invite_url);
            return (
              <article key={item.id} className="flex min-w-0 flex-col rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-10 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-5" /></span>
                  <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase ${active ? "text-bull" : "text-warning"}`}><span className={`size-1.5 rounded-full ${active ? "bg-bull" : "bg-warning"}`} />{active ? "Live" : "Maintenance"}</span>
                </div>
                <h3 className="mt-4 text-sm font-bold">{item.display_name}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground"><Users className="size-3.5" /> {Number(item.member_count).toLocaleString()} members</p>
                {item.vip_only ? (
                  vip && active ? <Button asChild className="mt-4 w-full"><a href={item.invite_url ?? "#"} target="_blank" rel="noreferrer">{item.action_label}<ArrowUpRight /></a></Button>
                    : vip ? <Button className="mt-4 w-full" onClick={() => requestMutation.mutate()} disabled={requestMutation.isPending}>Request VIP Access</Button>
                    : <Button asChild variant="outline" className="mt-4 w-full"><Link to={authed ? "/vip-upgrade" : "/auth"}><LockKeyhole />{authed ? "VIP Required" : "Sign In for VIP"}</Link></Button>
                ) : active ? (
                  <Button asChild variant="outline" className="mt-4 w-full"><a href={item.invite_url ?? "#"} target="_blank" rel="noreferrer">{item.action_label}<ArrowUpRight /></a></Button>
                ) : <Button variant="outline" className="mt-4 w-full" disabled>Temporarily Unavailable</Button>}
              </article>
            );
          })}
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div>
            <h3 className="text-base font-bold">What members do</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                [Radio, "Live Trade Signals & Market Analysis", "Daily technical breakdowns from lead desks."],
                [MessageCircle, "Direct Support & AMA Sessions", "Weekly interactive sessions with trading leads and support agents."],
                [Users, "Peer-to-Peer Knowledge Sharing", "Network with global retail and institutional traders."],
                [Gift, "Exclusive Airdrops & Promo Events", "Early access to trading competitions and fee discount programs."],
              ].map(([Icon, title, body]) => <div key={String(title)} className="flex gap-3 border-t border-border pt-3"><Icon className="mt-0.5 size-4 shrink-0 text-primary" /><div><h4 className="text-xs font-semibold">{String(title)}</h4><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{String(body)}</p></div></div>)}
            </div>
          </div>
          <div>
            <h3 className="text-base font-bold">Community bulletin</h3>
            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
              {(bulletins.data ?? []).length ? (bulletins.data ?? []).map((item) => <article key={item.id} className="border-b border-border p-4 last:border-0"><div className="flex items-center justify-between gap-3"><span className="text-[10px] font-semibold uppercase text-primary">{item.category.replace("security", "Security Alert")}</span><span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</span></div><h4 className="mt-1 text-sm font-semibold">{item.title}</h4><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{item.body}</p></article>) : <p className="p-5 text-sm text-muted-foreground">No active community bulletins.</p>}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-warning">
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div><p className="text-sm font-semibold">Verified channels only</p><p className="mt-1 text-xs leading-relaxed">Always verify official links. Velocity staff will never message you first or ask for private keys.</p></div>
        </div>
      </div>
    </section>
  );
}