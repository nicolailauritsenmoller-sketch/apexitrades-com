import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, BellRing, Check, ExternalLink, Globe2, MessageSquareText, Pencil, Radio, Save, ShieldAlert, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getCommunityDesk, reviewCommunityVipRequest, updateCommunityChannel, upsertCommunityAnnouncement } from "@/lib/community.functions";

type DeskData = Awaited<ReturnType<typeof getCommunityDesk>>;
type Channel = DeskData["channels"][number];
type Announcement = DeskData["announcements"][number];

export function CommunityDeskPanel() {
  const qc = useQueryClient();
  const getDesk = useServerFn(getCommunityDesk);
  const updateChannel = useServerFn(updateCommunityChannel);
  const saveAnnouncement = useServerFn(upsertCommunityAnnouncement);
  const reviewRequest = useServerFn(reviewCommunityVipRequest);
  const desk = useQuery({ queryKey: ["admin-community"], queryFn: () => getDesk() });
  const [draft, setDraft] = useState({ id: undefined as string | undefined, title: "", body: "", category: "event" as "signal" | "event" | "security" | "maintenance", status: "draft" as "published" | "draft" });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["admin-community"] });

  useEffect(() => {
    const channel = supabase.channel("community-desk-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "community_channels" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_announcements" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "community_vip_requests" }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [qc]);

  const channelMutation = useMutation({
    mutationFn: (input: { id: string; inviteUrl: string | null; memberCount: number; status: "active" | "maintenance" }) => updateChannel({ data: input }),
    onSuccess: () => { toast.success("Official channel updated"); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const announcementMutation = useMutation({
    mutationFn: () => saveAnnouncement({ data: draft }),
    onSuccess: () => { toast.success(draft.status === "published" ? "Community announcement published" : "Draft saved"); setDraft({ id: undefined, title: "", body: "", category: "event", status: "draft" }); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const reviewMutation = useMutation({
    mutationFn: (input: { id: string; action: "approve" | "reject"; note?: string }) => reviewRequest({ data: input }),
    onSuccess: (_result, input) => { toast.success(`VIP access ${input.action === "approve" ? "approved" : "rejected"}`); refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });

  if (desk.isLoading) return <p className="text-sm text-muted-foreground">Loading Community Desk…</p>;
  if (desk.isError || !desk.data) return <p className="text-sm text-ops-red">{(desk.error as Error)?.message ?? "Community Desk unavailable."}</p>;

  const pending = desk.data.requests.filter((request: any) => request.status === "pending");
  return (
    <Tabs defaultValue="channels" className="space-y-4">
      <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-md border border-border bg-card p-1">
        <TabsTrigger value="channels"><Globe2 /> Channels</TabsTrigger>
        <TabsTrigger value="bulletin"><BellRing /> Bulletin</TabsTrigger>
        <TabsTrigger value="requests"><Users /> VIP Access {pending.length ? <span className="rounded-full bg-ops-red px-1.5 text-[10px] text-background">{pending.length}</span> : null}</TabsTrigger>
      </TabsList>

      <TabsContent value="channels" className="mt-0 grid gap-4 lg:grid-cols-2">
        {desk.data.channels.map((channel: Channel) => <ChannelEditor key={channel.id} channel={channel} saving={channelMutation.isPending} onSave={(input) => channelMutation.mutate(input)} />)}
      </TabsContent>

      <TabsContent value="bulletin" className="mt-0 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">Announcement history</h2><p className="text-xs text-muted-foreground">Published and draft landing-page bulletins.</p></header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border bg-secondary/30 text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr></thead>
              <tbody>{desk.data.announcements.map((item: Announcement) => <tr key={item.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-3 text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</td><td className="px-4 py-3 font-semibold">{item.title}</td><td className="px-4 py-3 capitalize">{item.category}</td><td className="px-4 py-3"><Status status={item.status} /></td><td className="px-4 py-3 text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setDraft({ id: item.id, title: item.title, body: item.body, category: item.category as any, status: item.status as any })}><Pencil />Edit</Button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="text-sm font-semibold">{draft.id ? "Edit announcement" : "New community announcement"}</h2>
          <div className="mt-4 space-y-3">
            <Input value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} placeholder="Announcement title" maxLength={120} />
            <Textarea value={draft.body} onChange={(event) => setDraft((value) => ({ ...value, body: event.target.value }))} placeholder="Write the community bulletin…" rows={8} maxLength={4000} />
            <div className="grid grid-cols-2 gap-2">
              <Select value={draft.category} onValueChange={(category) => setDraft((value) => ({ ...value, category: category as typeof value.category }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="signal">Signal</SelectItem><SelectItem value="event">Event</SelectItem><SelectItem value="security">Security Alert</SelectItem><SelectItem value="maintenance">Maintenance</SelectItem></SelectContent></Select>
              <Select value={draft.status} onValueChange={(status) => setDraft((value) => ({ ...value, status: status as typeof value.status }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="published">Published</SelectItem><SelectItem value="draft">Draft</SelectItem></SelectContent></Select>
            </div>
            <div className="flex gap-2"><Button type="button" className="flex-1" onClick={() => announcementMutation.mutate()} disabled={announcementMutation.isPending || draft.title.trim().length < 2 || draft.body.trim().length < 2}><Save />{draft.status === "published" ? "Publish" : "Save Draft"}</Button>{draft.id ? <Button type="button" variant="outline" onClick={() => setDraft({ id: undefined, title: "", body: "", category: "event", status: "draft" })}><X />Cancel</Button> : null}</div>
          </div>
        </section>
      </TabsContent>

      <TabsContent value="requests" className="mt-0">
        <section className="overflow-hidden rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3"><h2 className="text-sm font-semibold">VIP Community Access Requests</h2><p className="text-xs text-muted-foreground">Review access to private Telegram and Discord channels.</p></header>
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border bg-secondary/30 text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3">Requested</th><th className="px-4 py-3">User</th><th className="px-4 py-3">UID</th><th className="px-4 py-3">VIP Status</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Review</th></tr></thead><tbody>{desk.data.requests.length ? desk.data.requests.map((request: any) => <tr key={request.id} className="border-b border-border/70 last:border-0"><td className="px-4 py-3 text-muted-foreground">{new Date(request.created_at).toLocaleString()}</td><td className="px-4 py-3"><p className="font-semibold">{request.profile?.display_name ?? "Unknown"}</p><p className="text-muted-foreground">{request.profile?.email ?? "—"}</p></td><td className="px-4 py-3 font-mono">{request.profile?.uid ?? "—"}</td><td className="px-4 py-3">{request.profile?.vip_tier === "vip1" ? "VIP" : "Not eligible"}</td><td className="px-4 py-3"><Status status={request.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-2"><Button type="button" size="sm" className="bg-ops-emerald text-background hover:bg-ops-emerald/90" disabled={request.status !== "pending" || reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: request.id, action: "approve" })}><Check />Approve</Button><Button type="button" size="sm" variant="destructive" disabled={request.status !== "pending" || reviewMutation.isPending} onClick={() => { const note = window.prompt("Reason for rejection (optional)") ?? undefined; reviewMutation.mutate({ id: request.id, action: "reject", note }); }}><X />Reject</Button></div></td></tr>) : <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No VIP community access requests.</td></tr>}</tbody></table></div>
        </section>
      </TabsContent>
    </Tabs>
  );
}

function ChannelEditor({ channel, saving, onSave }: { channel: Channel; saving: boolean; onSave: (value: { id: string; inviteUrl: string | null; memberCount: number; status: "active" | "maintenance" }) => void }) {
  const [url, setUrl] = useState(channel.invite_url ?? "");
  const [count, setCount] = useState(Number(channel.member_count));
  const [active, setActive] = useState(channel.status === "active");
  return <section className="rounded-lg border border-border bg-card p-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-semibold">{channel.display_name}</h2><p className="mt-1 text-xs text-muted-foreground">{channel.description}</p></div><Status status={active ? "active" : "maintenance"} /></div><div className="mt-4 space-y-3"><label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase text-muted-foreground">Official invite URL</span><div className="flex gap-2"><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://official-channel.example" />{url ? <Button asChild type="button" variant="outline" size="icon"><a href={url} target="_blank" rel="noreferrer" aria-label="Open official link"><ExternalLink /></a></Button> : null}</div></label><div className="grid grid-cols-[1fr_auto] gap-3"><label className="block space-y-1.5"><span className="text-[10px] font-semibold uppercase text-muted-foreground">Public member count</span><Input type="number" min={0} value={count} onChange={(event) => setCount(Math.max(0, Number(event.target.value)))} /></label><label className="flex items-end gap-2 pb-2 text-xs font-medium"><Switch checked={active} onCheckedChange={setActive} />{active ? "Active" : "Maintenance"}</label></div><Button type="button" className="w-full" disabled={saving || (active && !url.trim())} onClick={() => onSave({ id: channel.id, inviteUrl: url.trim() || null, memberCount: count, status: active ? "active" : "maintenance" })}><Save />Save Channel</Button></div></section>;
}

function Status({ status }: { status: string }) {
  const positive = status === "published" || status === "approved" || status === "active";
  const negative = status === "rejected";
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${positive ? "border-ops-emerald/25 bg-ops-emerald-bg text-ops-emerald" : negative ? "border-ops-red/25 bg-ops-red-bg text-ops-red" : "border-ops-amber/25 bg-ops-amber-bg text-ops-amber"}`}>{positive ? <BadgeCheck className="size-3" /> : negative ? <ShieldAlert className="size-3" /> : <Radio className="size-3" />}{status}</span>;
}