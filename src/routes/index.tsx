import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Gauge, Layers, Lock, ShieldCheck, Zap } from "lucide-react";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";
import { AssetIcon } from "@/lib/asset-icons";
import { SiteFooter } from "@/components/SiteFooter";
import { CaseInPointSection, GlobalMembershipSection } from "@/components/home/HomeSections";
import { AmbientMarketBackdrop } from "@/components/home/AmbientMarketBackdrop";
import { ThemeToggle } from "@/lib/theme";
import brandLogo from "@/assets/velocity-trade-logo.png";

const TICKER = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "NVDA",
  "AAPL",
  "TSLA",
  "ES=F",
  "NQ=F",
  "EURUSD=X",
  "GBPUSD=X",
  "GC=F",
  "SI=F",
];

const MARKET_GROUPS = [
  { label: "Crypto", detail: "BTC, ETH, SOL and majors", symbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT"] },
  { label: "Stocks", detail: "US large caps", symbols: ["NVDA", "AAPL", "TSLA"] },
  { label: "Futures", detail: "Index & commodity", symbols: ["ES=F", "NQ=F"] },
  { label: "Forex & metals", detail: "Majors, gold & silver", symbols: ["EURUSD=X", "GC=F", "SI=F"] },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Velocity Trade — Scalp Crypto, Stocks, Futures, Forex & Gold" },
      {
        name: "description",
        content:
          "A multi-currency paper trading terminal on live market data. Scalp crypto, trade stocks, futures, forex and gold with USD, EUR, GBP, USDT and BTC wallets.",
      },
      { property: "og:title", content: "Velocity Trade — Multi-Currency Trading" },
      {
        property: "og:description",
        content:
          "Live prices, leverage, and multi-currency wallets across crypto, stocks, futures, forex and gold.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { quotes } = useQuotes(TICKER, 8000);
  const row = TICKER.map((s) => ({ symbol: s, quote: quotes[s] }));

  return (
    <div className="relative w-full max-w-full overflow-x-hidden bg-background">
      <AmbientMarketBackdrop fixed intensity={0.5} />
      <header className="relative z-40 sticky top-0 w-full border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={brandLogo}
              alt="Velocity Trade logo"
              width={1024}
              height={1024}
              className="size-9 shrink-0 object-contain"
            />
            <span className="truncate font-display text-sm font-bold">VELOCITY TRADE</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Link
              to="/auth"
              className="min-h-9 touch-manipulation rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Open account
            </Link>
          </div>
        </div>
      </header>

      {/* Live ticker tape */}
      <div className="relative z-10 w-full max-w-full overflow-hidden border-b border-border bg-surface/70 py-2 backdrop-blur-sm">
        <div className="marquee flex w-max gap-8 whitespace-nowrap">
          {[...row, ...row].map((r, i) => (
            <span key={i} className="num flex items-center gap-2 text-xs">
              <AssetIcon symbol={r.symbol} size={16} />
              <span className="text-muted-foreground">{displaySymbol(r.symbol)}</span>
              <span>{r.quote ? formatPrice(r.quote.price, r.symbol) : "—"}</span>
              <span className={(r.quote?.changePercent ?? 0) >= 0 ? "text-bull" : "text-bear"}>
                {r.quote
                  ? `${r.quote.changePercent >= 0 ? "+" : ""}${r.quote.changePercent.toFixed(2)}%`
                  : ""}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* 1. Hero */}
      <section className="hero-glow relative z-10 w-full max-w-full overflow-hidden">
        <div className="grid-lines absolute inset-0 opacity-[0.35]" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-20 text-center sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="live-dot size-1.5 rounded-full bg-bull" />
            Live market data · paper execution
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            One terminal for <span className="text-primary">scalping crypto</span>, stocks,
            futures, forex and gold
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Real prices from live exchanges. Multi-currency wallets in USD, EUR, GBP, USDT and BTC.
            Leverage up to 20x — with zero real money at risk.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="glow-primary inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start trading free <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/markets"
              className="inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl border border-border bg-surface px-6 text-sm font-semibold transition-colors hover:bg-surface-raised"
            >
              Browse markets
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Platform introduction */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="min-w-0">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              A professional terminal, without the capital risk
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Velocity Trade streams live prices from crypto exchanges and global market data providers,
              then settles your orders against those quotes in simulated multi-currency wallets.
              You get the workflow of a professional desk — charting, order tickets, timed scalp
              contracts, position management and verified withdrawals — while you build the habits
              that matter.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "5", v: "Asset classes" },
              { k: "5", v: "Wallet currencies" },
              { k: "20x", v: "Max leverage" },
              { k: "60s", v: "Fastest contract" },
            ].map((s) => (
              <div key={s.v} className="rounded-2xl border border-border bg-surface p-4">
                <p className="num text-2xl font-bold text-primary">{s.k}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.v}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Markets / trading opportunities */}
      <section className="relative z-10 w-full max-w-full border-y border-border bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Markets you can trade</h2>
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MARKET_GROUPS.map((g) => (
              <div key={g.label} className="min-w-0 rounded-2xl border border-border bg-background p-5">
                <h3 className="text-sm font-semibold">{g.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{g.detail}</p>
                <ul className="mt-4 space-y-2">
                  {g.symbols.map((s) => (
                    <li key={s} className="num flex min-w-0 items-center gap-2 text-xs">
                      <AssetIcon symbol={s} size={16} />
                      <span className="truncate text-muted-foreground">{displaySymbol(s)}</span>
                      <span className="ml-auto shrink-0">
                        {quotes[s] ? formatPrice(quotes[s].price, s) : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Trading features */}
      <section className="relative z-10 w-full max-w-full overflow-hidden">
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Trading features</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Gauge,
              title: "Scalping terminal",
              body: "1m–1d timeframes, one-click Buy Long / Sell Short and instant fills at the live mid price.",
            },
            {
              icon: Layers,
              title: "Five asset classes",
              body: "Crypto pairs, US equities, index & commodity futures, major FX and precious metals.",
            },
            {
              icon: ShieldCheck,
              title: "Multi-currency wallets",
              body: "Margin is drawn and settled in the instrument's own currency, tracked per wallet.",
            },
            {
              icon: Zap,
              title: "Real prices, no risk",
              body: "Every quote is live. Every trade is paper. Learn the tape without burning capital.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
        </div>
      </section>

      {/* 5. Crypto trading access */}
      <div className="relative z-10">
        <CaseInPointSection />
      </div>

      {/* 6. Global membership */}
      <div className="relative z-10">
        <GlobalMembershipSection />
      </div>

      {/* 7. Security & platform features */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Security & platform</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Lock, title: "Protected sessions", body: "Every device is tracked and can be revoked from your profile at any time." },
            { icon: ShieldCheck, title: "Verified identity", body: "KYC documents are stored in private, owner-scoped encrypted storage." },
            { icon: Zap, title: "Consent-first privacy", body: "Analytics and marketing technologies stay off until you allow them." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="min-w-0 rounded-2xl border border-border bg-surface p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Call to action */}
      <section className="relative z-10 w-full max-w-full border-t border-border bg-surface/70 backdrop-blur-sm">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to trade the live tape?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
            Create your account in under a minute and start scalping on real market data.
          </p>
          <Link
            to="/auth"
            className="mt-7 inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground"
          >
            Create account <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* 9. Footer */}
      <div className="relative z-10">
        <SiteFooter />
      </div>
    </div>
  );
}
