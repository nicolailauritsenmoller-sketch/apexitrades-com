import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, MessageCircle, Repeat2, Plus, Share2, Check, ShieldCheck, Crown, Zap, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { summarizeDesks } from "@/lib/leaderboard-summary";
import { LEADERBOARD_REFRESH_MS, rotateRankedCards } from "@/lib/leaderboard-refresh";

const ASSETS = ["All", "BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "AVAX", "ADA", "LINK"] as const;
type Entry = {
  position_id: string; leader_id: string; public_name: string; bio: string; avatar_url: string | null;
  symbol: string; display_symbol: string; asset_class: string; side: string; leverage: number;
  entry_price: number; exit_price: number | null; realized_pnl: number; pnl_pct: number | null; closed_at: string;
  trades_30d: number; volume_30d: number; pnl_30d: number; margin_30d: number;
  sharpe: number | null; sortino: number | null; max_drawdown_pct: number | null;
  kyc_verified: boolean; vip_level: number; copy_traders: number; views: number; shares: number;
};
const usdK = (v: number) => { const a = Math.abs(v); const t = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0); return `${v < 0 ? "-" : ""}$${t}`; };
const ratio = (v: number | null) => (v == null ? "-" : num(Number(v)));

const num = (v: number, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const px = (v: number | null) => (v == null ? "-" : num(Number(v), Number(v) >= 100 ? 2 : Number(v) >= 1 ? 4 : 6));
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};
const rankClass = (r: number) => r === 1 ? "bg-primary text-primary-foreground" : r <= 3 ? "bg-secondary text-foreground ring-1 ring-primary/40" : "bg-secondary text-muted-foreground";

function Spark({ symbol, up, markers = false }: { symbol: string; up: boolean; markers?: boolean }) {
  const q = useQuery({
    queryKey: ["lb-spark", symbol],
    staleTime: LEADERBOARD_REFRESH_MS,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const r = await fetch(`https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=1h&limit=24`);
      if (!r.ok) throw new Error("Live chart temporarily unavailable");
      return ((await r.json()) as string[][]).map(k => Number(k[4]));
    },
  });
  const d = q.data;
  if (!d?.length) return <div className="h-12 w-24" />;
  const min = Math.min(...d), max = Math.max(...d), span = max - min || 1;
  const pts = d.map((v, i) => `${(i / (d.length - 1)) * 96},${46 - ((v - min) / span) * 42}`).join(" ");
  return <svg viewBox="0 0 96 48" className="h-12 w-24" aria-label={`${symbol} 24h price`}><polyline points={pts} fill="none" strokeWidth="1.5" className={up ? "stroke-bull" : "stroke-bear"} />
    {markers && [[3, "B", "fill-bull"], [d.length - 4, "S", "fill-bear"]].map(([i, l, c]) => { const x = (Number(i) / (d.length - 1)) * 96, y = 46 - ((d[Number(i)] - min) / span) * 42; return <g key={String(l)}><circle cx={x} cy={y} r="5" className={String(c)} /><text x={x} y={y + 2.5} textAnchor="middle" fontSize="7" fontWeight="700" className="fill-background">{l}</text></g>; })}
  </svg>;
}

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
          <span className="font-semibold">{c.pair}</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Perp</span><span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{c.lev}X</span>
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
      const { data, error } = await supabase.rpc("leaderboard_desks", { p_asset: asset === "All" ? undefined : asset });
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
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
      : rotateRankedCards(feed.data, cycle).map(({ entry: e, rank }) => {
        const up = e.realized_pnl >= 0;
        const following = mine.data?.follows.has(e.leader_id) ?? false;
        const badges = [
          e.kyc_verified && { icon: ShieldCheck, label: "Verified Desk" },
          e.vip_level >= 3 && { icon: Crown, label: "Prime Tier" },
          Number(e.trades_30d) >= 50 && { icon: Zap, label: "High-Frequency Desk" },
        ].filter(Boolean) as { icon: typeof Crown; label: string }[];
        const isMe = e.leader_id === me;
        return <article key={e.position_id} className="rounded-2xl border border-border bg-card p-3.5 touch-manipulation transition-colors duration-300 motion-reduce:transition-none">
          <header className="flex items-center gap-2.5">
            <span className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${rankClass(rank)}`}>{rank}</span>
            {e.avatar_url ? <img src={e.avatar_url} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{e.public_name.slice(0, 1).toUpperCase()}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{e.public_name}</p>
              <p className="text-[11px] text-muted-foreground">{Number(e.trades_30d)} trades (30d) - 30d PnL <span className={Number(e.pnl_30d) >= 0 ? "text-bull" : "text-bear"}>{usdK(Number(e.pnl_30d))}</span></p>
            </div>
            {!isMe && <Button size="sm" variant={following ? "secondary" : "outline"} className="h-8 rounded-full px-3 text-xs" disabled={!me || follow.isPending} onClick={() => follow.mutate({ id: e.leader_id, on: following })}>
              {following ? <><Check className="size-3.5" />Following</> : <><Plus className="size-3.5" />Follow</>}
            </Button>}
          </header>
          {badges.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{badges.map(b => <span key={b.label} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"><b.icon className="size-3" />{b.label}</span>)}</div>}
          <dl className="mt-2.5 grid grid-cols-3 gap-2 rounded-xl border border-border p-2.5 text-[11px]">
            <div><dt className="text-muted-foreground">Sharpe / Sortino</dt><dd className="mt-0.5 font-mono font-semibold">{ratio(e.sharpe)} / {ratio(e.sortino)}</dd></div>
            <div><dt className="text-muted-foreground">Max Drawdown (30d)</dt><dd className="mt-0.5 font-mono font-semibold text-bear">{e.max_drawdown_pct == null ? "-" : `-${num(Number(e.max_drawdown_pct))}%`}</dd></div>
            <div><dt className="text-muted-foreground">Allocated Capital</dt><dd className="mt-0.5 font-mono font-semibold">{usdK(Number(e.margin_30d))}</dd></div>
          </dl>
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
                <p className="font-mono text-[10px] text-muted-foreground">Executed {new Date(e.closed_at).toISOString().slice(0, 16).replace("T", " ")} UTC ({ago(e.closed_at)})</p>
              </div>
              <Spark symbol={e.symbol} up={up} />
            </div>
            <Button asChild size="sm" className="mt-3 h-9 w-full rounded-full"><Link to="/trade" search={{ symbol: e.symbol }}>Mirror Trade / Execute</Link></Button>
          </div>
          <footer className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex min-h-10 items-center gap-1 px-1" title="Views"><Eye className="size-4" />{Number(e.views)} views</span>
            <span className="flex min-h-10 items-center gap-1 px-1" title="Verified copy-traders"><Users className="size-4" />{Number(e.copy_traders)} copy-traders</span>
            <button type="button" onClick={() => void share(e)} className="flex min-h-10 items-center gap-1 px-1" aria-label="Share execution"><Share2 className="size-4" />{Number(e.shares)} shares</button>
          </footer>
        </article>;
      })}
  </div>;
}
