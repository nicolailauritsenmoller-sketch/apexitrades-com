import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Gauge, Layers, ShieldCheck, Zap } from "lucide-react";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";

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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Velocity Terminal — Scalp Crypto, Stocks, Futures, Forex & Gold" },
      {
        name: "description",
        content:
          "A multi-currency paper trading terminal on live market data. Scalp crypto, trade stocks, futures, forex and gold with USD, EUR, GBP, USDT and BTC wallets.",
      },
      { property: "og:title", content: "Velocity Terminal — Multi-Currency Trading" },
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
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <Zap className="size-4" strokeWidth={2.8} />
            </span>
            <span className="font-display text-sm font-bold">VELOCITY</span>
          </div>
          <Link
            to="/auth"
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Open paper account
          </Link>
        </div>
      </header>

      {/* Live ticker tape */}
      <div className="overflow-hidden border-b border-border bg-surface py-2">
        <div className="marquee flex w-max gap-8 whitespace-nowrap">
          {[...row, ...row].map((r, i) => (
            <span key={i} className="num flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{displaySymbol(r.symbol)}</span>
              <span>{r.quote ? formatPrice(r.quote.price, r.symbol) : "—"}</span>
              <span
                className={
                  (r.quote?.changePercent ?? 0) >= 0 ? "text-bull" : "text-bear"
                }
              >
                {r.quote ? `${r.quote.changePercent >= 0 ? "+" : ""}${r.quote.changePercent.toFixed(2)}%` : ""}
              </span>
            </span>
          ))}
        </div>
      </div>

      <section className="hero-glow relative overflow-hidden">
        <div className="grid-lines absolute inset-0 opacity-[0.35]" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span className="live-dot size-1.5 rounded-full bg-bull" />
            Live market data · paper execution
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-[1.05] sm:text-6xl">
            One terminal for{" "}
            <span className="text-primary">scalping crypto</span>, stocks, futures, forex and
            gold
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Real prices from live exchanges. Multi-currency wallets in USD, EUR, GBP, USDT and
            BTC. Leverage up to 100x — with zero real money at risk.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link
              to="/auth"
              className="glow-primary inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Start trading free <ArrowUpRight className="size-4" />
            </Link>
            <Link
              to="/markets"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-6 py-3 text-sm font-semibold transition-colors hover:bg-surface-raised"
            >
              Browse markets
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Gauge,
              title: "Scalping terminal",
              body: "1m–1d timeframes, one-click long/short and instant fills at the live mid price.",
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
            <div key={title} className="panel p-5">
              <Icon className="size-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Velocity Terminal is a simulated trading environment. Prices are live; positions are not.
      </footer>
    </div>
  );
}
