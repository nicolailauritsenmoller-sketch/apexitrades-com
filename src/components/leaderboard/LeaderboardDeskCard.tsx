import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Crown, Eye, Plus, Share2, ShieldCheck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssetIcon } from "@/lib/asset-icons";
import { LEADERBOARD_REFRESH_MS } from "@/lib/leaderboard-refresh";

export type DeskEntry = {
  position_id: string; leader_id: string; public_name: string; bio: string; avatar_url: string | null;
  symbol: string; display_symbol: string; asset_class: string; side: string; leverage: number;
  entry_price: number; exit_price: number | null; realized_pnl: number; pnl_pct: number | null; closed_at: string;
  trades_30d: number; volume_30d: number; pnl_30d: number; margin_30d: number;
  sharpe: number | null; sortino: number | null; max_drawdown_pct: number | null;
  kyc_verified: boolean; vip_level: number; copy_traders: number; views: number; shares: number;
};

export const usdK = (v: number) => { const a = Math.abs(v); const t = a >= 1e9 ? `${(a / 1e9).toFixed(2)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}K` : a.toFixed(0); return `${v < 0 ? "-" : ""}$${t}`; };
export const num = (v: number, d = 2) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const ratio = (v: number | null) => (v == null ? "-" : num(Number(v)));
const px = (v: number | null) => (v == null ? "-" : num(Number(v), Number(v) >= 100 ? 2 : Number(v) >= 1 ? 4 : 6));
const ago = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};
export const rankClass = (r: number) => r === 1 ? "bg-primary text-primary-foreground" : r <= 3 ? "bg-secondary text-foreground ring-1 ring-primary/40" : "bg-secondary text-muted-foreground";

export function Spark({ symbol, up, markers = false }: { symbol: string; up: boolean; markers?: boolean }) {
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

/** The live leaderboard card. `preview` disables every action for the admin staging view. */
export function LeaderboardDeskCard({ entry: e, rank, following = false, isMe = false, canFollow = false, followPending = false, onFollow, onShare, preview = false }: {
  entry: DeskEntry; rank: number; following?: boolean; isMe?: boolean; canFollow?: boolean; followPending?: boolean;
  onFollow?: () => void; onShare?: () => void; preview?: boolean;
}) {
  const up = e.realized_pnl >= 0;
  const badges = [
    e.kyc_verified && { icon: ShieldCheck, label: "Verified Desk" },
    e.vip_level >= 3 && { icon: Crown, label: "Prime Tier" },
    Number(e.trades_30d) >= 50 && { icon: Zap, label: "High-Frequency Desk" },
  ].filter(Boolean) as { icon: typeof Crown; label: string }[];
  return <article className="rounded-lg border border-border bg-card p-4 touch-manipulation transition-colors duration-300 motion-reduce:transition-none sm:p-5">
    <header className="flex items-center gap-2.5">
      <span className={`grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold ${rankClass(rank)}`}>{rank}</span>
      {e.avatar_url ? <img src={e.avatar_url} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold">{e.public_name.slice(0, 1).toUpperCase()}</span>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{e.public_name}</p>
        <p className="text-[11px] text-muted-foreground">{Number(e.trades_30d)} trades (30d) - 30d PnL <span className={Number(e.pnl_30d) >= 0 ? "text-bull" : "text-bear"}>{usdK(Number(e.pnl_30d))}</span></p>
      </div>
      {!isMe && <Button size="sm" variant={following ? "secondary" : "outline"} className="min-h-10 rounded-md px-3 text-xs" disabled={preview || !canFollow || followPending} onClick={onFollow}>
        {following ? <><Check className="size-3.5" />Following</> : <><Plus className="size-3.5" />Follow</>}
      </Button>}
    </header>
    {badges.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{badges.map(b => <span key={b.label} className="inline-flex items-center gap-1 rounded border border-bull/25 bg-bull/5 px-2 py-1 text-[10px] font-medium text-bull"><b.icon className="size-3" />{b.label}</span>)}</div>}
    <dl className="mt-4 grid grid-cols-3 divide-x divide-border border-y border-border bg-surface/40 py-3 text-[10px]">
      <div className="px-2"><dt className="text-muted-foreground">Sharpe / Sortino</dt><dd className="mt-1 break-words font-mono text-[11px] font-semibold">{ratio(e.sharpe)} / {ratio(e.sortino)}</dd></div>
      <div className="px-2"><dt className="text-muted-foreground">Max Drawdown (30d)</dt><dd className="mt-1 font-mono text-[11px] font-semibold text-bear">{e.max_drawdown_pct == null ? "-" : `-${num(Number(e.max_drawdown_pct))}%`}</dd></div>
      <div className="px-2"><dt className="text-muted-foreground">Committed margin (30d)</dt><dd className="mt-1 font-mono text-[11px] font-semibold">{usdK(Number(e.margin_30d))}</dd></div>
    </dl>
    {e.bio && <p className="mt-2.5 text-sm leading-relaxed">{e.bio}</p>}
    <div className="mt-4 border-y border-border bg-surface px-3 py-4">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <AssetIcon symbol={e.symbol} size={22} /><span className="font-semibold">{e.display_symbol}</span>
        {e.asset_class === "future" && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">Perp</span>}
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{num(Number(e.leverage), 0)}X</span>
        <span className="text-muted-foreground">Closed</span>
        <span className={`font-semibold capitalize ${e.side === "long" ? "text-bull" : "text-bear"}`}>{e.side}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">Realized PNL (USDT)</p>
          <p className={`font-mono text-lg font-semibold ${up ? "text-bull" : "text-bear"}`}>{up ? "+" : ""}{num(Number(e.realized_pnl))} {e.pnl_pct != null && <span className="text-sm">{up ? "+" : ""}{num(Number(e.pnl_pct))}%</span>}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">Entry {px(e.entry_price)} - Close {px(e.exit_price)}</p>
          <p className="font-mono text-[10px] text-muted-foreground">Executed {new Date(e.closed_at).toISOString().slice(0, 16).replace("T", " ")} UTC ({ago(e.closed_at)})</p>
        </div>
        <Spark symbol={e.symbol} up={up} />
      </div>
      {preview
        ? <Button size="sm" className="mt-4 min-h-11 w-full rounded-md" disabled>Mirror Trade / Execute</Button>
        : <Button asChild size="sm" className="mt-4 min-h-11 w-full rounded-md"><Link to="/trade" search={{ symbol: e.symbol }}>Mirror Trade / Execute</Link></Button>}
    </div>
    <footer className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
      <span className="flex min-h-10 items-center gap-1 px-1" title="Views"><Eye className="size-4" />{Number(e.views)} views</span>
      <span className="flex min-h-10 items-center gap-1 px-1" title="Verified copy-traders"><Users className="size-4" />{Number(e.copy_traders)} copy-traders</span>
      <Button variant="ghost" type="button" disabled={preview} onClick={onShare} className="flex min-h-10 items-center gap-1 px-1 text-xs text-muted-foreground" aria-label="Share execution"><Share2 className="size-4" />{Number(e.shares)} shares</Button>
    </footer>
  </article>;
}

/** Applies an approved post's curated name and commentary; trade figures always stay from the real position. */
export function applyPublishedPost(entry: DeskEntry, post: { display_name: string | null; commentary: string | null }): DeskEntry {
  return { ...entry, public_name: post.display_name?.trim() || entry.public_name, bio: post.commentary?.trim() || entry.bio };
}

/** Only trades with an approved post appear on the public feed. */
export function publishedFeed(entries: DeskEntry[], posts: { position_id: string; display_name: string | null; commentary: string | null }[]): DeskEntry[] {
  const byPosition = new Map(posts.map(p => [p.position_id, p]));
  return entries.flatMap(e => { const p = byPosition.get(e.position_id); return p ? [applyPublishedPost(e, p)] : []; });
}
