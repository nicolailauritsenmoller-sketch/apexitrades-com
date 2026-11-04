import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AssetIcon } from "@/lib/asset-icons";
import { getAlpha } from "@/lib/alpha.functions";
import { getNewListings } from "@/lib/new-listings.functions";
import { getDiscoveryNews } from "@/lib/news.functions";
import { captureDeskPerformance, getDiscoveryDesk, saveDiscoveryArticle, saveDiscoveryModeration } from "@/lib/discovery-admin.functions";

export function DiscoveryDesk() {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getDiscoveryDesk), saveRule = useServerFn(saveDiscoveryModeration), saveArticle = useServerFn(saveDiscoveryArticle), capture = useServerFn(captureDeskPerformance);
  const fetchAlpha = useServerFn(getAlpha), fetchListings = useServerFn(getNewListings), fetchNews = useServerFn(getDiscoveryNews);
  const desk = useQuery({ queryKey: ["discovery-desk"], queryFn: () => fetchDesk(), refetchInterval: 300_000 });
  const alpha = useQuery({ queryKey: ["editorial-alpha"], queryFn: () => fetchAlpha() });
  const listings = useQuery({ queryKey: ["editorial-listings"], queryFn: () => fetchListings() });
  const news = useQuery({ queryKey: ["editorial-news"], queryFn: () => fetchNews() });
  const [kind, setKind] = useState<"listing" | "alpha" | "news">("listing"), [contentId, setContentId] = useState(""), [reason, setReason] = useState("");
  const [status, setStatus] = useState<"approved" | "hidden" | "featured">("hidden");
  const [title, setTitle] = useState(""), [excerpt, setExcerpt] = useState(""), [tickers, setTickers] = useState("");
  const [articleId, setArticleId] = useState<string | undefined>();
  const [articleStatus, setArticleStatus] = useState<"draft" | "published" | "withdrawn">("draft");
  const [category, setCategory] = useState<"crypto" | "stocks" | "macro">("crypto");
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["discovery-desk"] }); void qc.invalidateQueries({ queryKey: ["editorial-alpha"] }); void qc.invalidateQueries({ queryKey: ["editorial-listings"] }); void qc.invalidateQueries({ queryKey: ["editorial-news"] }); };
  const mutation = useMutation({ mutationFn: () => saveRule({ data: { kind, contentId, reason, status, priority: 0 } }), onSuccess: () => { toast.success("Moderation saved"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const publish = useMutation({ mutationFn: () => saveArticle({ data: { id: articleId, title, excerpt, tickers: tickers.split(",").map(s => s.trim().toUpperCase()).filter(Boolean), category, status: articleStatus } }), onSuccess: ({ id }) => { setArticleId(id); toast.success("Article saved"); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const snapshot = useMutation({ mutationFn: () => capture(), onSuccess: ({ captured }) => { toast.success(`${captured} measured desks captured`); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  const selectClass = "h-10 min-w-0 rounded-md border border-input bg-background px-3 text-sm";
  const candidates = kind === "listing" ? (listings.data?.rows ?? []).map(r => ({ id: r.symbol, title: `${r.ticker} - ${r.name}` })) : kind === "alpha" ? (alpha.data?.rows ?? []).map(r => ({ id: r.tokenId, title: `${r.ticker} - ${r.name}` })) : (news.data ?? []).map(r => ({ id: r.id, title: r.title }));
  return <div className="space-y-8">
    {desk.error && <p role="alert" className="text-bear">{desk.error.message}</p>}
    <section className="space-y-3">
      <h2 className="text-base font-semibold">Listings & Alpha moderation</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <select aria-label="Content type" className={selectClass} value={kind} onChange={e => { setKind(e.target.value as typeof kind); setContentId(""); }}><option value="listing">Recently Listed Assets</option><option value="alpha">Velocity Alpha</option><option value="news">News feed</option></select>
        <select aria-label="Live content" className={selectClass} value={contentId} onChange={e => setContentId(e.target.value)}><option value="">Select live content</option>{candidates.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select>
        <Input aria-label="Content ID" placeholder="Content ID" value={contentId} onChange={e => setContentId(e.target.value)} />
        <select aria-label="Moderation status" className={selectClass} value={status} onChange={e => setStatus(e.target.value as typeof status)}><option value="hidden">Hidden</option><option value="approved">Approved</option><option value="featured">Featured</option></select>
        <Input aria-label="Moderation reason" placeholder="Moderation reason" value={reason} onChange={e => setReason(e.target.value)} />
        <Button onClick={() => mutation.mutate()} disabled={!contentId || reason.trim().length < 3 || mutation.isPending}>Save moderation</Button>
      </div>
      <div className="divide-y divide-border">{desk.data?.moderation.map(r => <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="break-all">{r.content_kind} · {r.content_id} · {r.status}</span><Button variant="outline" size="sm" onClick={() => { setKind(r.content_kind as typeof kind); setContentId(r.content_id); setStatus(r.status as typeof status); setReason(r.reason); }}>Edit</Button></div>)}</div>
    </section>
    <section className="space-y-3 border-t border-border pt-6">
      <h2 className="text-base font-semibold">Institutional news publishing</h2>
      <Input aria-label="Article title" placeholder="Article title" value={title} onChange={e => setTitle(e.target.value)} maxLength={180} />
      <Textarea aria-label="Article body" placeholder="Article body" value={excerpt} onChange={e => setExcerpt(e.target.value)} maxLength={3000} />
      <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Article assets" placeholder="BTCUSDT, ETHUSDT" value={tickers} onChange={e => setTickers(e.target.value)} /><select aria-label="Article category" className={selectClass} value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="crypto">Crypto</option><option value="stocks">Stocks</option><option value="macro">Macro</option></select><select aria-label="Article status" className={selectClass} value={articleStatus} onChange={e => setArticleStatus(e.target.value as typeof articleStatus)}><option value="draft">Draft</option><option value="published">Published</option><option value="withdrawn">Withdrawn</option></select></div>
      <div className="flex gap-2"><Button disabled={title.trim().length < 3 || excerpt.trim().length < 10 || publish.isPending} onClick={() => publish.mutate()}>Save article</Button><Button variant="outline" onClick={() => { setArticleId(undefined); setTitle(""); setExcerpt(""); setTickers(""); setArticleStatus("draft"); }}>New article</Button></div>
      <div className="divide-y divide-border">{desk.data?.articles.map(r => <div key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span>{r.title} · {r.status}</span><Button variant="outline" size="sm" onClick={() => { setArticleId(r.id); setTitle(r.title); setExcerpt(r.excerpt); setTickers(r.tickers.join(", ")); setArticleStatus(r.status as typeof articleStatus); setCategory(["crypto", "stocks", "macro"].includes(r.category) ? r.category as typeof category : "crypto"); }}>Edit</Button></div>)}</div>
    </section>
    <section className="space-y-3 border-t border-border pt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">Measured desk performance</h2><Button variant="outline" disabled={snapshot.isPending} onClick={() => snapshot.mutate()}>Capture snapshot</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border"><th className="py-3">Desk / asset</th><th>30-day volume</th><th>30-day P&L</th><th>Sharpe</th><th>Sortino</th><th>Drawdown</th></tr></thead><tbody>{desk.data?.leaders.map(r => <tr key={r.leader_id} className="border-b border-border"><td className="flex items-center gap-2 py-3"><AssetIcon symbol={r.symbol} size={24} />{r.public_name}</td><td>{Number(r.volume_30d).toLocaleString()}</td><td>{Number(r.pnl_30d).toLocaleString()}</td><td>{r.sharpe ?? "-"}</td><td>{r.sortino ?? "-"}</td><td>{r.max_drawdown_pct ?? "-"}%</td></tr>)}</tbody></table></div>
      {!desk.data?.leaders.length && <p className="text-sm text-muted-foreground">No approved desks with measured closed-trade results.</p>}
      <h3 className="text-sm font-semibold">Snapshot history</h3>{desk.data?.snapshots.map(r => <div key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border py-2 text-xs"><span>{r.public_name} · Sharpe {r.sharpe ?? "-"}</span><time>{new Date(r.captured_at).toISOString()}</time></div>)}
    </section>
  </div>;
}