import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Heart, Plus, Repeat2, Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const ASSETS = ["All", "BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "AVAX", "ADA", "LINK"] as const;
type Entry = {
  position_id: string; leader_id: string; public_name: string; bio: string; avatar_url: string | null;
  symbol: string; display_symbol: string; asset_class: string; side: string; leverage: number;
  entry_price: number; exit_price: number | null; realized_pnl: number; pnl_pct: number | null; closed_at: string;
  likes: number; reposts: number; views: number; followers: number;
};

const num = (v: number, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const px = (v: number | null) => (v == null ? "-" : num(Number(v), Number(v) >= 100 ? 2 : Number(v) >= 1 ? 4 : 6));
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};
const rankClass = (r: number) => r === 1 ? "bg-primary text-primary-foreground" : r <= 3 ? "bg-secondary text-foreground ring-1 ring-primary/40" : "bg-secondary text-muted-foreground";

function Spark({ symbol, up }: { symbol: string; up: boolean }) {
  const q = useQuery({
    queryKey: ["lb-spark", symbol],
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
      if (!r.ok) return null;
      return ((await r.json()) as string[][]).map(k => Number(k[4]));
    },
  });
  const d = q.data;
  if (!d?.length) return <div className="h-12 w-24" />;
  const min = Math.min(...d), max = Math.max(...d), span = max - min || 1;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * 96},${46 - ((v - min) / span) * 42}`).join(" ");
  return <svg viewBox="0 0 96 48" className="h-12 w-24" aria-label={`${symbol} 24h price`}><polyline points={pts} fill="none" strokeWidth="1.5" className={up ? "stroke-bull" : "stroke-bear"} /></svg>;
}

export function LeaderboardPanel() {
  const qc = useQueryClient();
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("All");
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const feed = useQuery({
    queryKey: ["leaderboard", asset],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("leaderboard_feed", { p_asset: asset === "All" ? undefined : asset });
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });
  const mine = useQuery({
    queryKey: ["leaderboard-mine", me],
    enabled: !!me,
    queryFn: async () => {
      const [f, e] = await Promise.all([
        supabase.from("leaderboard_follows").select("leader_id"),
        supabase.from("leaderboard_engagement").select("position_id,kind"),
      ]);
      return { follows: new Set((f.data ?? []).map(r => r.leader_id)), eng: new Set((e.data ?? []).map(r => `${r.position_id}:${r.kind}`)) };
    },
  });

  // Record one view per viewer per shared position.
  useEffect(() => {
    if (!me || !feed.data?.length || !mine.data) return;
    const rows = feed.data.filter(e => !mine.data!.eng.has(`${e.position_id}:view`)).map(e => ({ user_id: me, position_id: e.position_id, kind: "view" }));
    if (rows.length) void supabase.from("leaderboard_engagement").upsert(rows, { ignoreDuplicates: true });
  }, [me, feed.data, mine.data]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["leaderboard"] }); void qc.invalidateQueries({ queryKey: ["leaderboard-mine"] }); };
  const follow = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const r = on ? await supabase.from("leaderboard_follows").delete().eq("leader_id", id) : await supabase.from("leaderboard_follows").insert({ user_id: me!, leader_id: id });
      if (r.error) throw r.error;
    },
    onSuccess: refresh, onError: () => toast.error("Could not update follow"),
  });
  const engage = useMutation({
    mutationFn: async ({ id, kind, on }: { id: string; kind: "like" | "repost"; on: boolean }) => {
      const r = on ? await supabase.from("leaderboard_engagement").delete().eq("position_id", id).eq("kind", kind) : await supabase.from("leaderboard_engagement").insert({ user_id: me!, position_id: id, kind });
      if (r.error) throw r.error;
    },
    onSuccess: refresh, onError: () => toast.error("Could not update"),
  });
  async function share(e: Entry) {
    const text = `${e.public_name} closed ${e.display_symbol} ${e.side} ${e.leverage}X: ${e.realized_pnl >= 0 ? "+" : ""}${num(e.realized_pnl)} USDT on Velocity Trade`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.origin });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    } catch { /* dismissed */ }
  }

  return <div className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Velocity Leaderboard</h2>
        <p className="text-xs text-muted-foreground">Everything that ranks, all in one place</p>
      </div>
      <select value={asset} onChange={e => setAsset(e.target.value as typeof asset)} aria-label="Filter by asset" className="h-9 rounded-full border border-border bg-secondary px-3 text-xs font-medium outline-none touch-manipulation">
        {ASSETS.map(a => <option key={a}>{a}</option>)}
      </select>
    </div>

    {feed.isPending ? <p className="py-5 text-sm text-muted-foreground">Loading leaderboard...</p>
      : feed.isError ? <p className="py-5 text-sm text-muted-foreground">Leaderboard is unavailable right now.</p>
      : !feed.data?.length ? <p className="py-5 text-sm text-muted-foreground">No ranked trades in the last 30 days{asset !== "All" ? ` for ${asset}` : ""}. Approved copy leaders appear here once they close a position.</p>
      : feed.data.map((e, i) => {
        const up = e.realized_pnl >= 0;
        const following = mine.data?.follows.has(e.leader_id) ?? false;
        const liked = mine.data?.eng.has(`${e.position_id}:like`) ?? false;
        const reposted = mine.data?.eng.has(`${e.position_id}:repost`) ?? false;
        const isMe = e.leader_id === me;
        return <article key={e.position_id} className="rounded-2xl border border-border bg-card p-3.5 touch-manipulation">
          <header className="flex items-center gap-2.5">
            <span className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${rankClass(i + 1)}`}>{i + 1}</span>
            {e.avatar_url ? <img src={e.avatar_url} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{e.public_name.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.public_name}</p>
              <p className="text-[11px] text-muted-foreground">{ago(e.closed_at)} - {Number(e.followers)} followers</p>
            </div>
            {!isMe && <Button size="sm" variant={following ? "secondary" : "outline"} className="h-8 rounded-full px-3 text-xs" disabled={!me || follow.isPending} onClick={() => follow.mutate({ id: e.leader_id, on: following })}>
              {following ? <><Check className="size-3.5" />Following</> : <><Plus className="size-3.5" />Follow</>}
            </Button>}
          </header>
          {e.bio && <p className="mt-2.5 text-sm leading-relaxed">{e.bio}</p>}
          <div className="mt-3 rounded-xl bg-secondary/60 p-3">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-semibold">{e.display_symbol}</span>
              {e.asset_class === "future" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Perp</span>}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{num(Number(e.leverage), 0)}X</span>
              <span className="text-muted-foreground">Closed</span>
              <span className={`font-semibold capitalize ${e.side === "long" ? "text-bull" : "text-bear"}`}>{e.side}</span>
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">Realized PNL (USDT)</p>
                <p className={`font-mono text-lg font-semibold ${up ? "text-bull" : "text-bear"}`}>{up ? "+" : ""}{num(Number(e.realized_pnl))} {e.pnl_pct != null && <span className="text-sm">{up ? "+" : ""}{num(Number(e.pnl_pct))}%</span>}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">Entry {px(e.entry_price)} - Close {px(e.exit_price)}</p>
              </div>
              <Spark symbol={e.symbol} up={up} />
            </div>
            <Button asChild size="sm" className="mt-3 h-9 w-full rounded-full"><Link to="/trade" search={{ symbol: e.symbol }}>Trade</Link></Button>
          </div>
          <footer className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <button type="button" disabled={!me} onClick={() => engage.mutate({ id: e.position_id, kind: "repost", on: reposted })} className={`flex min-h-10 items-center gap-1 px-1 ${reposted ? "text-bull" : ""}`} aria-label="Repost"><Repeat2 className="size-4" />{Number(e.reposts)}</button>
            <button type="button" disabled={!me} onClick={() => engage.mutate({ id: e.position_id, kind: "like", on: liked })} className={`flex min-h-10 items-center gap-1 px-1 ${liked ? "text-bear" : ""}`} aria-label="Like"><Heart className={`size-4 ${liked ? "fill-current" : ""}`} />{Number(e.likes)}</button>
            <span className="flex min-h-10 items-center gap-1 px-1" aria-label="Views"><Eye className="size-4" />{Number(e.views)}</span>
            <button type="button" onClick={() => void share(e)} className="flex min-h-10 items-center gap-1 px-1" aria-label="Share"><Share2 className="size-4" /></button>
          </footer>
        </article>;
      })}
  </div>;
}
