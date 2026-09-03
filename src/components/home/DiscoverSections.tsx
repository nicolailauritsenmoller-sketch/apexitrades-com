import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Repeat,
  Send,
  QrCode,
  Newspaper,
  ExternalLink,
} from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";
import { getMarketNews, type NewsCategory } from "@/lib/news.functions";

/* ------------------------------- Quick actions ------------------------------ */

const ACTIONS = [
  { label: "Buy", tab: "deposit", icon: ArrowDownToLine, tone: "bg-emerald-600" },
  { label: "Sell", tab: "withdraw", icon: ArrowUpFromLine, tone: "bg-rose-600" },
  { label: "Swap", tab: "swap", icon: Repeat, tone: "bg-primary" },
  { label: "Send", tab: "withdraw", icon: Send, tone: "bg-slate-600" },
  { label: "Receive", tab: "deposit", icon: QrCode, tone: "bg-slate-600" },
] as const;

export function QuickActionsRow() {
  return (
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {ACTIONS.map(({ label, tab, icon: Icon, tone }) => (
        <Link
          key={label}
          to="/wallet"
          search={{ tab }}
          className="flex touch-manipulation flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface px-1 py-3 text-[11px] font-semibold transition-transform active:scale-[0.97] sm:text-xs"
        >
          <span className={`grid size-10 place-items-center rounded-full text-white ${tone}`}>
            <Icon className="size-5" strokeWidth={2.4} />
          </span>
          {label}
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------ Explore tokens ------------------------------ */

const TOKENS = [
  { symbol: "BTCUSDT", name: "Bitcoin" },
  { symbol: "ETHUSDT", name: "Ethereum" },
  { symbol: "BNBUSDT", name: "BNB Smart Chain" },
  { symbol: "USDTUSD", name: "Tether" },
  { symbol: "SOLUSDT", name: "Solana" },
  { symbol: "ADAUSDT", name: "Cardano" },
] as const;

export function ExploreTokensSection() {
  const { quotes } = useQuotes(
    TOKENS.map((t) => t.symbol),
    8000,
  );

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight sm:text-base">Explore tokens</h2>
        <Link to="/markets" className="text-xs font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {TOKENS.map((t) => {
          const q = quotes[t.symbol];
          const chg = q?.changePercent ?? 0;
          return (
            <Link
              key={t.symbol}
              to="/terminal/$symbol"
              params={{ symbol: t.symbol }}
              className="flex touch-manipulation items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:bg-surface-raised"
            >
              <AssetIcon symbol={t.symbol} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.name}</p>
                <p className="num text-xs text-muted-foreground">{displaySymbol(t.symbol)}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="num text-sm font-semibold">
                  {q ? formatPrice(q.price, t.symbol) : "—"}
                </p>
                <p className={`num text-xs ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                  {q ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------- Discover coins & perps -------------------------- */

const PERPS = [
  { symbol: "BTCUSDT", label: "BTC-PERP", leverage: "Up to 20x leverage" },
  { symbol: "ETHUSDT", label: "ETH-PERP", leverage: "Up to 15x leverage" },
  { symbol: "SOLUSDT", label: "SOL-PERP", leverage: "Up to 10x leverage" },
  { symbol: "AVAXUSDT", label: "AVAX-PERP", leverage: "Up to 10x leverage" },
] as const;

export function DiscoverPerpsSection() {
  const { quotes } = useQuotes(
    PERPS.map((p) => p.symbol),
    8000,
  );

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold tracking-tight sm:text-base">
        Discover coins &amp; perpetuals
      </h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PERPS.map((p) => {
          const q = quotes[p.symbol];
          const chg = q?.changePercent ?? 0;
          return (
            <Link
              key={p.label}
              to="/terminal/$symbol"
              params={{ symbol: p.symbol }}
              className="touch-manipulation rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-raised"
            >
              <div className="flex items-center gap-2">
                <AssetIcon symbol={p.symbol} size={26} />
                <p className="num text-sm font-bold">{p.label}</p>
              </div>
              <p className="num mt-3 text-base font-semibold">
                {q ? formatPrice(q.price, p.symbol) : "—"}
              </p>
              <p className={`num text-xs ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                {q ? `${chg >= 0 ? "+" : ""}${chg.toFixed(2)}%` : ""}
              </p>
              <p className="mt-2 inline-flex rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {p.leverage}
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* --------------------------------- Market news -------------------------------- */

const NEWS_TABS = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "gold", label: "Gold" },
  { id: "forex", label: "Forex" },
  { id: "futures", label: "Futures" },
  { id: "stocks", label: "Stocks" },
] as const;

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function MarketNewsSection() {
  const [tab, setTab] = useState<"all" | NewsCategory>("all");
  const fetchNews = useServerFn(getMarketNews);
  const news = useQuery({
    queryKey: ["market-news"],
    queryFn: () => fetchNews(),
    refetchInterval: 120_000,
    staleTime: 60_000,
  });

  const items = (news.data ?? []).filter((n) => tab === "all" || n.category === tab);

  return (
    <section className="mt-8 mb-10">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className="size-4 text-primary" />
        <h2 className="text-sm font-bold tracking-tight sm:text-base">Worldwide market news</h2>
        <span className="live-dot ml-1 size-1.5 rounded-full bg-bull" />
      </div>

      <div className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {NEWS_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 touch-manipulation rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              tab === t.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {news.isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading live headlines…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No headlines available right now.</p>
        ) : (
          items.slice(0, 20).map((n) => (
            <a
              key={n.id}
              href={n.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex touch-manipulation items-start gap-3 p-4 transition-colors hover:bg-surface-raised"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug">{n.title}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  {n.source} · {timeAgo(n.publishedAt)} · {n.category}
                </p>
              </div>
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            </a>
          ))
        )}
      </div>
    </section>
  );
}
