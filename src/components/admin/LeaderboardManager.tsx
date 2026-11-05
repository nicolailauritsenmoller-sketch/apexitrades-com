import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LeaderboardDeskCard, applyPublishedPost, num, type DeskEntry } from "@/components/leaderboard/LeaderboardDeskCard";
import { getLeaderboardManager, reviewLeaderboardPost, saveLeaderboardDraft } from "@/lib/leaderboard-posts.functions";
import { AdminActionConfirm } from "./AdminActionConfirm";

type Post = { id: string; position_id: string; display_name: string | null; commentary: string | null; status: "draft" | "published" | "rejected"; review_note: string | null; updated_at: string };
const TONE: Record<Post["status"], string> = { draft: "text-ops-amber", published: "text-ops-emerald", rejected: "text-ops-red" };

export function LeaderboardManager() {
  const qc = useQueryClient();
  const fetchManager = useServerFn(getLeaderboardManager), saveDraft = useServerFn(saveLeaderboardDraft), review = useServerFn(reviewLeaderboardPost);
  const q = useQuery({ queryKey: ["leaderboard-manager"], queryFn: () => fetchManager() });
  const trades = (q.data?.trades ?? []) as unknown as (DeskEntry & { public_eligible: boolean })[];
  const posts = (q.data?.posts ?? []) as Post[];
  const postByPosition = useMemo(() => new Map(posts.map(p => [p.position_id, p])), [posts]);
  const [positionId, setPositionId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [commentary, setCommentary] = useState("");
  const [rejecting, setRejecting] = useState<Post | null>(null);

  const trade = trades.find(t => t.position_id === positionId);
  const post = positionId ? postByPosition.get(positionId) : undefined;
  const select = (id: string) => {
    setPositionId(id);
    const existing = postByPosition.get(id);
    setDisplayName(existing?.display_name ?? "");
    setCommentary(existing?.commentary ?? "");
  };
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["leaderboard-manager"] }); void qc.invalidateQueries({ queryKey: ["leaderboard"] }); };
  const draft = useMutation({
    mutationFn: () => saveDraft({ data: { positionId, displayName: displayName.trim() || null, commentary: commentary.trim() || null } }),
    onSuccess: () => { toast.success("Draft saved"); refresh(); }, onError: (e: Error) => toast.error(e.message),
  });
  const act = useMutation({
    mutationFn: (v: { id: string; action: "publish" | "reject" | "unpublish"; note?: string }) => review({ data: v }),
    onSuccess: (_r, v) => { toast.success(v.action === "publish" ? "Published to leaderboard" : v.action === "reject" ? "Post rejected" : "Moved back to draft"); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const dirty = !!post && ((post.display_name ?? "") !== displayName.trim() || (post.commentary ?? "") !== commentary.trim());
  const previewEntry = trade ? applyPublishedPost(trade, { display_name: displayName, commentary }) : null;

  return <div className="space-y-6">
    <div>
      <h2 className="text-base font-semibold">Leaderboard Manager</h2>
      <p className="text-xs text-muted-foreground">Every closed trade from the last 30 days is listed here internally. Only trades from traders who opted in can be published. Trade figures, views, shares and copy-trader counts always come from the platform and cannot be edited. Nothing appears on the public leaderboard until you approve it.</p>
    </div>
    {q.error && <p role="alert" className="text-sm text-bear">{(q.error as Error).message}</p>}

    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Compose post</h3>
        <label className="block space-y-1.5 text-xs font-medium">Closed trade
          <select aria-label="Closed trade" value={positionId} onChange={e => select(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="">{q.isPending ? "Loading trades..." : trades.length ? "Select a closed trade" : "No closed trades in the last 30 days"}</option>
            {trades.map(t => <option key={t.position_id} value={t.position_id}>{t.public_name} - {t.display_symbol} {t.side} {num(Number(t.leverage), 0)}X - {Number(t.realized_pnl) >= 0 ? "+" : ""}{num(Number(t.realized_pnl))} USDT{t.public_eligible ? "" : " - internal only"}{postByPosition.get(t.position_id) ? ` (${postByPosition.get(t.position_id)!.status})` : ""}</option>)}
          </select>
        </label>
        <label className="block space-y-1.5 text-xs font-medium">Display name (optional)
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={32} placeholder={trade?.public_name ?? "Leader's public name"} disabled={!trade} />
        </label>
        <label className="block space-y-1.5 text-xs font-medium">Commentary (optional)
          <Textarea value={commentary} onChange={e => setCommentary(e.target.value)} maxLength={280} rows={3} placeholder={trade?.bio || "Short note shown on the card"} disabled={!trade} />
          <span className="block text-right text-[10px] text-muted-foreground">{commentary.length}/280</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!trade || draft.isPending} onClick={() => draft.mutate()}>{post ? "Save edits as draft" : "Save draft"}</Button>
          {post && post.status !== "published" && <Button disabled={dirty || act.isPending || !trade?.public_eligible} onClick={() => act.mutate({ id: post.id, action: "publish" })}>Approve & Publish</Button>}
          {post && post.status !== "rejected" && <Button variant="destructive" disabled={act.isPending} onClick={() => setRejecting(post)}>Reject</Button>}
          {post?.status === "published" && <Button variant="secondary" disabled={act.isPending} onClick={() => act.mutate({ id: post.id, action: "unpublish" })}>Unpublish</Button>}
        </div>
        {trade && !trade.public_eligible && <p className="text-[11px] text-muted-foreground">Internal only: this trader has not opted in to public display, so the card cannot be published.</p>}
        {dirty && <p className="text-[11px] text-muted-foreground">Save your edits as a draft before approving.</p>}
        {post?.status === "rejected" && post.review_note && <p className="text-[11px] text-muted-foreground">Rejection note: {post.review_note}</p>}
      </section>

      <section className="space-y-2">
        <h3 className="flex items-center justify-between text-sm font-semibold">Draft Preview {post && <span className={`text-xs capitalize ${TONE[post.status]}`}>{post.status}</span>}</h3>
        {previewEntry ? <LeaderboardDeskCard entry={previewEntry} rank={1} preview /> : <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Select a closed trade to preview its card.</p>}
      </section>
    </div>

    <section className="space-y-2">
      <h3 className="text-sm font-semibold">Posts</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground"><tr><th className="p-2">Trader</th><th className="p-2">Trade</th><th className="p-2">Status</th><th className="p-2">Updated</th><th className="p-2" /></tr></thead>
          <tbody>
            {posts.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">No posts yet.</td></tr>}
            {posts.map(p => { const t = trades.find(x => x.position_id === p.position_id); return <tr key={p.id} className="border-t border-border">
              <td className="p-2">{p.display_name || t?.public_name || "-"}</td>
              <td className="p-2 font-mono">{t ? `${t.display_symbol} ${t.side} ${num(Number(t.realized_pnl))}` : "Trade no longer eligible"}</td>
              <td className={`p-2 capitalize ${TONE[p.status]}`}>{p.status}</td>
              <td className="p-2 text-muted-foreground">{new Date(p.updated_at).toLocaleString()}</td>
              <td className="p-2 text-right"><Button size="sm" variant="ghost" disabled={!t} onClick={() => select(p.position_id)}>Edit</Button></td>
            </tr>; })}
          </tbody>
        </table>
      </div>
    </section>

    <AdminActionConfirm open={!!rejecting} title="Reject post" description="The card will not appear on the public leaderboard." optionalNote pending={act.isPending}
      onClose={() => setRejecting(null)} onConfirm={(note) => act.mutateAsync({ id: rejecting!.id, action: "reject", note: note || undefined })} />
  </div>;
}
