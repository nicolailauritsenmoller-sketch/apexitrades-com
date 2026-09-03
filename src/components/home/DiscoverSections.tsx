import { useMemo, useState } from "react";
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
  Bitcoin,
  Coins,
  Banknote,
  CandlestickChart,
  TrendingUp,
} from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";
import { getMarketNews, type NewsCategory, type NewsItem } from "@/lib/news.functions";

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
  { id: "stocks", label: "Stocks" },
  { id: "crypto", label: "Crypto" },
  { id: "commodities", label: "Commodities" },
  { id: "forex", label: "Forex" },
  { id: "macro", label: "Central Banks / Macro" },
  { id: "regulation", label: "Regulations" },
] as const;

const CATEGORY_LABEL: Record<NewsCategory, string> = {
  stocks: "Stocks",
  crypto: "Crypto",
  commodities: "Commodities",
  forex: "Forex",
  macro: "Central banks",
  regulation: "Regulations",
};

const CATEGORY_GRADIENT: Record<NewsCategory, string> = {
  crypto: "from-primary/30 via-primary/10 to-transparent",
  commodities: "from-amber-500/30 via-amber-500/10 to-transparent",
  forex: "from-sky-500/30 via-sky-500/10 to-transparent",
  macro: "from-violet-500/30 via-violet-500/10 to-transparent",
  regulation: "from-rose-500/30 via-rose-500/10 to-transparent",
  stocks: "from-emerald-500/30 via-emerald-500/10 to-transparent",
};

const CATEGORY_ICON: Record<NewsCategory, typeof Newspaper> = {
  crypto: Bitcoin,
  commodities: Coins,
  forex: Banknote,
  macro: CandlestickChart,
  regulation: Landmark,
  stocks: TrendingUp,
};


function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Publisher favicon with a lettered fallback when the brand icon can't load. */
function PublisherMark({ domain, source, size = 18 }: { domain: string; source: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!domain || failed) {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-primary/15 text-[9px] font-bold uppercase text-primary"
        style={{ width: size, height: size }}
        aria-hidden
      >
        {source.slice(0, 1)}
      </span>
    );
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full bg-surface-raised object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** Article thumbnail with a clean category illustration fallback. */
function NewsThumb({
  item,
  className,
  iconSize = 22,
}: {
  item: NewsItem;
  className: string;
  iconSize?: number;
}) {
  const [failed, setFailed] = useState(false);
  const Icon = CATEGORY_ICON[item.category];
  if (item.image && !failed) {
    return (
      <img
        src={item.image}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`${className} bg-surface-raised object-cover`}
      />
    );
  }
  return (
    <div
      className={`${className} grid place-items-center bg-gradient-to-br ${CATEGORY_GRADIENT[item.category]} bg-surface-raised`}
      aria-hidden
    >
      <Icon className="text-foreground/45" style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}

function TickerBadges({
  symbols,
  quotes,
}: {
  symbols: string[];
  quotes: Record<string, { price: number; changePercent: number } | undefined>;
}) {
  if (symbols.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {symbols.map((s) => {
        const q = quotes[s];
        const chg = q?.changePercent ?? 0;
        return (
          <span
            key={s}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-raised py-0.5 pl-0.5 pr-2 text-[10px] font-semibold"
          >
            <AssetIcon symbol={s} size={14} />
            <span className="num">{displaySymbol(s).split("/")[0]}</span>
            {q ? (
              <span className={`num ${chg >= 0 ? "text-bull" : "text-bear"}`}>
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            ) : null}
          </span>
        );
      })}
    </div>
  );
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

  const items = (news.data ?? []).filter((n) => tab === "all" || n.category === tab).slice(0, 13);
  const [lead, ...rest] = items;

  const symbols = useMemo(
    () => Array.from(new Set(items.flatMap((n) => n.tickers))).slice(0, 12),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items.map((n) => n.id).join("|")],
  );
  const { quotes } = useQuotes(symbols, 15000);

  return (
    <section className="mt-8 mb-10">
      <div className="mb-3 flex items-center gap-2">
        <Newspaper className="size-4 text-primary" />
        <h2 className="text-sm font-bold tracking-tight sm:text-base">Worldwide market news</h2>
        <span className="live-dot ml-1 size-1.5 rounded-full bg-bull" />
      </div>

      <div className="-mx-3 mb-4 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
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

      {news.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
          No headlines available right now.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Featured lead story */}
          {lead ? (
            <a
              href={lead.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group touch-manipulation overflow-hidden rounded-2xl border border-border bg-surface transition-all hover:border-primary/50 hover:bg-surface-raised lg:col-span-1 lg:row-span-2"
            >
              <NewsThumb item={lead} className="h-44 w-full sm:h-52" iconSize={44} />
              <div className="p-4">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <PublisherMark domain={lead.domain} source={lead.source} />
                  <span className="truncate font-semibold text-foreground">{lead.source}</span>
                  <span>·</span>
                  <span className="shrink-0">{timeAgo(lead.publishedAt)}</span>
                </div>
                <h3 className="mt-2 text-base font-bold leading-snug group-hover:text-primary">
                  {lead.title}
                </h3>
                {lead.excerpt ? (
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {lead.excerpt}
                  </p>
                ) : null}
                <TickerBadges symbols={lead.tickers} quotes={quotes} />
                <span className="mt-3 inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {lead.category}
                  <ExternalLink className="size-3" />
                </span>
              </div>
            </a>
          ) : null}

          {/* Secondary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:content-start">
            {rest.map((n) => (
              <a
                key={n.id}
                href={n.url || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex touch-manipulation gap-3 rounded-2xl border border-border bg-surface p-3 transition-all hover:border-primary/50 hover:bg-surface-raised"
              >
                <NewsThumb item={n} className="size-20 shrink-0 rounded-xl" iconSize={22} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <PublisherMark domain={n.domain} source={n.source} size={14} />
                    <span className="truncate font-semibold text-foreground">{n.source}</span>
                    <span>·</span>
                    <span className="shrink-0">{timeAgo(n.publishedAt)}</span>
                    <ExternalLink className="ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-1 line-clamp-3 text-[13px] font-semibold leading-snug group-hover:text-primary">
                    {n.title}
                  </p>
                  <TickerBadges symbols={n.tickers.slice(0, 2)} quotes={quotes} />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
