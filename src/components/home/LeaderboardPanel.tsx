import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MessageCircle, Repeat2, Plus, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/lib/asset-icons";
import { supabase } from "@/integrations/supabase/client";
import { summarizeDesks } from "@/lib/leaderboard-summary";
import { LEADERBOARD_REFRESH_MS, rotateRankedCards } from "@/lib/leaderboard-refresh";
import { LeaderboardDeskCard, Spark, num, publishedFeed, rankClass, usdK, type DeskEntry } from "@/components/leaderboard/LeaderboardDeskCard";

const ASSETS = ["All", "BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "AVAX", "ADA", "LINK"] as const;
type Entry = DeskEntry;

// Illustrative cards shown only while no real ranked trades exist; clearly labelled as samples.
const SAMPLES = [
  { name: "CryptoKing77", avatar: "C", time: "2h ago", quote: "Held through the retest. Patience paid on this breakout.", pair: "BTCUSDT", lev: 2, side: "Long", pnl: 1100943.19, pct: 24.27, entry: "64,812.40", close: "80,541.10", closeTime: "2026-11-04 19:42", comments: 128, shares: 342, likes: 2104, views: "48.2K" },
  { name: "AlphaKai", avatar: "A", time: "5h ago", quote: "Funding flipped negative and the squeeze did the rest.", pair: "ETHUSDT", lev: 5, side: "Long", pnl: 482310.55, pct: 61.08, entry: "2,931.20", close: "3,289.75", closeTime: "2026-11-04 16:05", comments: 76, shares: 190, likes: 1311, views: "27.9K" },
  { name: "MomentumMax", avatar: "M", time: "9h ago", quote: "Faded the range high, covered into support.", pair: "SOLUSDT", lev: 3, side: "Short", pnl: 156022.08, pct: 18.92, entry: "212.44", close: "199.03", closeTime: "2026-11-04 12:18", comments: 41, shares: 88, likes: 640, views: "12.4K" },
  { name: "SilentWhale", avatar: "S", time: "11h ago", quote: "Weekly close rejection gave a clean short entry.", pair: "BTCUSDT", lev: 3, side: "Short", pnl: 392114.40, pct: 31.05, entry: "82,110.00", close: "76,460.20", closeTime: "2026-11-04 10:27", comments: 94, shares: 210, likes: 1180, views: "22.6K" },
  { name: "QuantPulse", avatar: "Q", time: "14h ago", quote: "Momentum alignment on the 4H confirmed the continuation.", pair: "ETHUSDT", lev: 2, side: "Long", pnl: 217655.72, pct: 27.44, entry: "2,844.90", close: "3,025.35", closeTime: "2026-11-04 07:15", comments: 63, shares: 141, likes: 902, views: "17.8K" },
  { name: "IroncladDesk", avatar: "I", time: "18h ago", quote: "Sold the range top, added at the mid-band.", pair: "SOLUSDT", lev: 5, side: "Short", pnl: 98420.31, pct: 22.61, entry: "218.90", close: "204.62", closeTime: "2026-11-03 22:48", comments: 37, shares: 74, likes: 528, views: "10.9K" },
  { name: "DeltaNeutral", avatar: "D", time: "21h ago", quote: "Funding harvest with a delta hedge through expiry.", pair: "BNBUSDT", lev: 2, side: "Long", pnl: 41320.86, pct: 9.87, entry: "601.24", close: "641.05", closeTime: "2026-11-03 19:30", comments: 29, shares: 52, likes: 411, views: "8.3K" },
  { name: "GridMasterPro", avatar: "G", time: "1d ago", quote: "Grid reload filled lower. Range thesis intact.", pair: "XRPUSDT", lev: 4, side: "Long", pnl: 66418.02, pct: 15.32, entry: "0.5204", close: "0.5948", closeTime: "2026-11-03 15:09", comments: 44, shares: 96, likes: 673, views: "13.7K" },
  { name: "NightowlTrades", avatar: "N", time: "1d ago", quote: "Asia session grind lower. Trailing stop did the work.", pair: "DOGEUSDT", lev: 3, side: "Short", pnl: 28905.47, pct: 12.18, entry: "0.1642", close: "0.1513", closeTime: "2026-11-03 08:55", comments: 22, shares: 41, likes: 305, views: "6.8K" },
  { name: "MacroVisor", avatar: "V", time: "2d ago", quote: "Avalanche bid held the dev-band. Spot-led move.", pair: "AVAXUSDT", lev: 2, side: "Long", pnl: 51237.60, pct: 16.73, entry: "22.1800", close: "25.4600", closeTime: "2026-11-02 21:12", comments: 31, shares: 67, likes: 449, views: "9.1K" },
  { name: "BlueOceanFX", avatar: "B", time: "2d ago", quote: "Wyckoff spring on the daily. Target one banked.", pair: "ADAUSDT", lev: 3, side: "Long", pnl: 33712.95, pct: 14.05, entry: "0.4712", close: "0.5287", closeTime: "2026-11-02 14:36", comments: 19, shares: 38, likes: 287, views: "5.9K" },
  { name: "ApexQuant", avatar: "P", time: "3d ago", quote: "Oracle rotation trade. Sized for the weekly setup.", pair: "LINKUSDT", lev: 2, side: "Long", pnl: 21884.30, pct: 11.62, entry: "14.0240", close: "15.3980", closeTime: "2026-11-01 18:24", comments: 17, shares: 33, likes: 246, views: "5.2K" },
];

// Illustrative risk ratios, never presented as measured live performance.
const SAMPLE_SHARPES = [2.84, 2.61, 2.32, 2.45, 2.73, 1.98, 1.76, 2.12, 1.89, 2.24, 1.91, 2.06];
const SAMPLE_DESKS = SAMPLES.map((sample, index) => {
  const entry = Number(sample.entry.replaceAll(",", ""));
  const close = Number(sample.close.replaceAll(",", ""));
  const capital = sample.pnl / (sample.pct / 100);
  return { ...sample, volume_30d: capital * sample.lev * (1 + close / entry), pnl_30d: sample.pnl, sharpe: SAMPLE_SHARPES[index] };
});

function SampleCards({ asset, cycle }: { asset: string; cycle: number }) {
  return <div className="space-y-3">
    <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">Sample preview - illustrative cards, not real traders or results. Live rankings replace these once approved leaders close positions.</p>
    {rotateRankedCards(SAMPLES.filter(c => asset === "All" || c.pair === `${asset}USDT`), cycle).map(({ entry: c, rank }) => <article key={c.name} className="rounded-2xl border border-border bg-card p-3.5 touch-manipulation transition-colors duration-300 motion-reduce:transition-none">
      <header className="flex items-center gap-2.5">
        <span className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${rankClass(rank)}`}>{rank}</span>
        <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{c.avatar}</span>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{c.name}</p><p className="text-[11px] text-muted-foreground">{c.time}</p></div>
        <Button size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs" onClick={() => toast.info("Sample card - follow is available on live leaders")}><Plus className="size-3.5" />Follow</Button>
      </header>
      <p className="mt-2.5 text-sm leading-relaxed">{c.quote}</p>
      <div className="mt-3 rounded-xl bg-secondary/60 p-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <AssetIcon symbol={c.pair} size={22} /><span className="font-semibold">{c.pair}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Perp</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c.lev}X</span>
          <span className="text-muted-foreground">Closed</span><span className={`font-semibold ${c.side === "Long" ? "text-bull" : "text-bear"}`}>{c.side}</span>
        </div>
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-muted-foreground">Realized PNL (USDT)</p>
            <p className="font-mono text-lg font-semibold text-bull">+{num(c.pnl)} <span className="text-sm">+{num(c.pct)}%</span></p>
          </div>
          <Spark symbol={c.pair} up={c.side === "Long"} markers />
        </div>
        <dl className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div><dt className="text-muted-foreground">Entry Price</dt><dd className="font-mono">{c.entry}</dd></div>
          <div><dt className="text-muted-foreground">Avg. Close Price</dt><dd className="font-mono">{c.close}</dd></div>
          <div><dt className="text-muted-foreground">Close Time</dt><dd className="font-mono">{c.closeTime}</dd></div>
        </dl>
        <Button asChild size="sm" className="mt-3 h-9 w-full rounded-full"><Link to="/trade" search={{ symbol: c.pair }}>Trade</Link></Button>
      </div>
      <footer className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex min-h-10 items-center gap-1"><MessageCircle className="size-4" />{c.comments}</span>
        <span className="flex min-h-10 items-center gap-1"><Share2 className="size-4" />{c.shares}</span>
        <span className="flex min-h-10 items-center gap-1"><Repeat2 className="size-4" />{c.likes}</span>
        <span className="flex min-h-10 items-center gap-1"><Eye className="size-4" />{c.views}</span>
      </footer>
    </article>)}
  </div>;
}

export function LeaderboardPanel() {
  const qc = useQueryClient();
  const panelRef = useRef<HTMLDivElement>(null);
  const [cycle, setCycle] = useState(0);
  const [asset, setAsset] = useState<(typeof ASSETS)[number]>("All");
  const [me, setMe] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null)); }, []);

  const feed = useQuery({
    queryKey: ["leaderboard", asset],
    staleTime: LEADERBOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [desks, posts] = await Promise.all([
        supabase.rpc("leaderboard_desks", { p_asset: asset === "All" ? undefined : asset }),
        supabase.from("leaderboard_posts").select("position_id,display_name,commentary").eq("status", "published"),
      ]);
      if (desks.error) throw desks.error;
      if (posts.error) throw posts.error;
      return publishedFeed((desks.data ?? []) as unknown as Entry[], posts.data ?? []);
    },
  });
  const refetchLeaderboard = feed.refetch;
  useEffect(() => {
    let mounted = true;
    const timer = window.setInterval(() => {
      void refetchLeaderboard().then(result => {
        // Keep prior rows on failure and never move a focused trading/follow control.
        if (!mounted || result.isError) return;
        if (!panelRef.current?.contains(document.activeElement)) setCycle(value => value + 1);
        void qc.invalidateQueries({ queryKey: ["lb-spark"] });
        void qc.invalidateQueries({ queryKey: ["leaderboard-mine"] });
      });
    }, LEADERBOARD_REFRESH_MS);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [refetchLeaderboard, qc]);
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
    const engagement = mine.data.eng;
    const rows = feed.data.filter(e => !engagement.has(`${e.position_id}:view`)).map(e => ({ user_id: me, position_id: e.position_id, kind: "view" }));
    if (rows.length) void supabase.from("leaderboard_engagement").upsert(rows, { ignoreDuplicates: true });
  }, [me, feed.data, mine.data]);

  const refresh = () => { void qc.invalidateQueries({ queryKey: ["leaderboard"] }); void qc.invalidateQueries({ queryKey: ["leaderboard-mine"] }); };
  const follow = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      if (!me) throw new Error("Sign in to follow a desk");
      const r = on ? await supabase.from("leaderboard_follows").delete().eq("leader_id", id) : await supabase.from("leaderboard_follows").insert({ user_id: me, leader_id: id });
      if (r.error) throw r.error;
    },
    onSuccess: refresh, onError: () => toast.error("Could not update follow"),
  });
  async function share(e: Entry) {
    const text = `${e.public_name} closed ${e.display_symbol} ${e.side} ${e.leverage}X: ${e.realized_pnl >= 0 ? "+" : ""}${num(e.realized_pnl)} USDT on Velocity Trade`;
    if (me) void supabase.from("leaderboard_engagement").upsert({ user_id: me, position_id: e.position_id, kind: "share" }, { ignoreDuplicates: true }).then(refresh);
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.origin });
      else { await navigator.clipboard.writeText(text); toast.success("Copied to clipboard"); }
    } catch { /* dismissed */ }
  }

  return <div ref={panelRef} className="space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold">Velocity Institutional Desk Leaderboard</h2>
        <p className="text-xs text-muted-foreground">Verified liquidity providers, algorithmic funds, and top-tier traders.</p>
      </div>
      <select value={asset} onChange={e => setAsset(e.target.value as typeof asset)} aria-label="Filter by asset" className="h-9 shrink-0 rounded-full border border-border bg-secondary px-3 text-xs font-medium outline-none touch-manipulation">
        {ASSETS.map(a => <option key={a}>{a}</option>)}
      </select>
    </div>
    {(() => {
      const rows = feed.data ?? [];
      const samples = feed.data !== undefined && rows.length === 0;
      const summary = summarizeDesks(samples ? SAMPLE_DESKS.filter(c => asset === "All" || c.pair === `${asset}USDT`) : rows.map(r => ({ volume_30d: Number(r.volume_30d), pnl_30d: Number(r.pnl_30d), sharpe: r.sharpe === null ? null : Number(r.sharpe) })));
      const items = [
        { label: "Total Tracked Volume", value: rows.length || samples ? usdK(summary.volume) : "-" },
        { label: "Avg. Institutional Sharpe Ratio", value: summary.sharpe !== null ? num(summary.sharpe) : "-" },
        { label: "Top Desk 30-Day PnL", value: summary.topPnl !== null ? usdK(summary.topPnl) : "-" },
      ];
      return <div className="grid grid-cols-3 gap-2">{items.map(m => <div key={m.label} className="rounded-xl border border-border bg-card p-2.5"><p className="text-[10px] leading-tight text-muted-foreground">{m.label}</p><p className="mt-1 font-mono text-sm font-semibold">{m.value}</p>{samples && <p className="mt-1 text-[9px] text-muted-foreground">Sample data</p>}</div>)}</div>;
    })()}

    {feed.isPending ? <p className="py-5 text-sm text-muted-foreground">Loading leaderboard...</p>
      : feed.isError && !feed.data ? <p className="py-5 text-sm text-muted-foreground">Leaderboard is unavailable right now.</p>
      : !feed.data?.length ? <SampleCards asset={asset} cycle={cycle} />
      : rotateRankedCards(feed.data, cycle).map(({ entry: e, rank }) => <LeaderboardDeskCard key={e.position_id} entry={e} rank={rank}
          following={mine.data?.follows.has(e.leader_id) ?? false} isMe={e.leader_id === me} canFollow={!!me} followPending={follow.isPending}
          onFollow={() => follow.mutate({ id: e.leader_id, on: mine.data?.follows.has(e.leader_id) ?? false })} onShare={() => void share(e)} />)}
  </div>;
}
