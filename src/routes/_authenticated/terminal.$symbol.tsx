import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Star, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { CandleChart } from "@/components/CandleChart";
import { TimedContractPanel } from "@/components/TimedContractPanel";
import { AssetIcon } from "@/lib/asset-icons";
import { PositionsTable, type PositionRow } from "@/components/PositionsTable";
import { useCandles, useQuotes } from "@/hooks/useMarket";
import { getPortfolio, openPosition, getWatchlist, toggleWatchlist } from "@/lib/trading.functions";
import {
  ASSET_CLASS_LABEL,
  INSTRUMENT_MAP,
  INSTRUMENTS,
  displaySymbol,
  formatMoney,
  formatPrice,
} from "@/lib/instruments";
import { TIMEFRAMES, type Timeframe } from "@/lib/market-types";

export const Route = createFileRoute("/_authenticated/terminal/$symbol")({
  loader: ({ params }) => {
    const inst = INSTRUMENT_MAP[params.symbol];
    if (!inst) throw notFound();
    return { name: inst.name, ticker: displaySymbol(inst.symbol) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Unavailable — Velocity Terminal" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.ticker} scalping terminal — Velocity`;
    const description = `Live ${loaderData.name} chart, order ticket and open positions for fast scalp entries and exits.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: Terminal,
  errorComponent: ({ error }) => (
    <div role="alert" className="p-8 text-sm text-bear">
      {error.message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm">
      Unknown instrument.{" "}
      <Link to="/markets" className="text-primary underline">
        Browse markets
      </Link>
    </div>
  ),
});

const LEVERAGES = [1, 2, 5, 10, 20];

function Terminal() {
  const { symbol } = Route.useParams();
  const inst = INSTRUMENT_MAP[symbol];
  const queryClient = useQueryClient();

  const [timeframe, setTimeframe] = useState<Timeframe>("1m");
  const [quantity, setQuantity] = useState(String(inst.step));
  const [leverage, setLeverage] = useState(1);

  const { quotes } = useQuotes([symbol], 3000);
  const quote = quotes[symbol];
  const candles = useCandles(symbol, timeframe);

  const fetchPortfolio = useServerFn(getPortfolio);
  const portfolio = useQuery({
    queryKey: ["portfolio"],
    queryFn: () => fetchPortfolio(),
    refetchInterval: 20_000,
  });

  const fetchWatchlist = useServerFn(getWatchlist);
  const watchlist = useQuery({
    queryKey: ["watchlist"],
    queryFn: () => fetchWatchlist(),
  });
  const toggle = useServerFn(toggleWatchlist);
  const toggleMutation = useMutation({
    mutationFn: () => toggle({ data: { symbol } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const open = useServerFn(openPosition);
  const orderMutation = useMutation({
    mutationFn: (side: "long" | "short") =>
      open({ data: { symbol, side, quantity: Number(quantity), leverage } }),
    onSuccess: (res) => {
      toast.success(
        `Filled at ${formatPrice(res.entryPrice, symbol)} · margin ${formatMoney(res.margin, res.currency)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const positions = (portfolio.data?.positions ?? []) as PositionRow[];
  const openHere = positions.filter((p) => p.status === "open" && p.symbol === symbol);
  const wallets = portfolio.data?.wallets ?? [];
  const wallet = wallets.find((w) => w.currency === inst.currency);
  const usdtBalance = wallets.find((w) => w.currency === "USDT")?.balance;
  const qty = Number(quantity) || 0;
  const notional = (quote?.price ?? 0) * qty;
  const margin = notional / leverage;
  const up = (quote?.changePercent ?? 0) >= 0;
  const starred = watchlist.data?.includes(symbol) ?? false;

  // Fold the live quote into the most recent candle so the chart ticks in real time.
  const liveCandles = useMemo(() => {
    const rows = candles.data ?? [];
    const price = quote?.price;
    if (rows.length === 0 || !price) return rows;
    const last = rows[rows.length - 1];
    return [
      ...rows.slice(0, -1),
      { ...last, c: price, h: Math.max(last.h, price), l: Math.min(last.l, price) },
    ];
  }, [candles.data, quote?.price]);

  const related = INSTRUMENTS.filter(
    (i) => i.assetClass === inst.assetClass && i.symbol !== symbol,
  ).slice(0, 8);


  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <AssetIcon symbol={symbol} size={30} />
              <h1 className="text-2xl font-bold">{displaySymbol(symbol)}</h1>
              <button
                onClick={() => toggleMutation.mutate()}
                aria-label="Toggle watchlist"
                className="text-muted-foreground transition-colors hover:text-primary"
              >
                <Star className={`size-4 ${starred ? "fill-primary text-primary" : ""}`} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {inst.name} · {ASSET_CLASS_LABEL[inst.assetClass]} · settles in {inst.currency}
            </p>
          </div>
          <div className="pl-4">
            <div className="num text-2xl font-semibold">
              {quote ? formatPrice(quote.price, symbol) : "—"}
            </div>
            <div className={`num flex items-center gap-1 text-xs ${up ? "text-bull" : "text-bear"}`}>
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {quote ? `${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)` : "—"}
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2.5 py-1 text-xs transition-colors ${
                timeframe === tf
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel p-4">
          {candles.isLoading ? (
            <div className="flex h-[380px] items-center justify-center text-sm text-muted-foreground">
              Loading chart…
            </div>
          ) : (
            <CandleChart candles={liveCandles} symbol={symbol} />
          )}
        </div>


        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
              Order ticket
            </h2>
            <span className="num text-xs text-muted-foreground">
              {wallet ? formatMoney(wallet.balance, wallet.currency) : "—"}
            </span>
          </div>

          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Quantity
          </label>
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            inputMode="decimal"
            className="num mb-2 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <div className="mb-4 flex gap-1.5">
            {[1, 2, 5, 10].map((m) => (
              <button
                key={m}
                onClick={() => setQuantity(String(+(inst.step * m).toFixed(8)))}
                className="flex-1 rounded border border-border py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {+(inst.step * m).toFixed(8)}
              </button>
            ))}
          </div>

          <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
            Leverage
          </label>
          <div className="mb-4 flex gap-1.5">
            {LEVERAGES.map((l) => (
              <button
                key={l}
                onClick={() => setLeverage(l)}
                className={`flex-1 rounded py-1 text-xs transition-colors ${
                  leverage === l
                    ? "bg-primary text-primary-foreground"
                    : "border border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {l}x
              </button>
            ))}
          </div>

          <dl className="mb-4 space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Notional</dt>
              <dd className="num">{formatMoney(notional, inst.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Margin required</dt>
              <dd className="num">{formatMoney(margin, inst.currency)}</dd>
            </div>
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => orderMutation.mutate("long")}
              disabled={orderMutation.isPending || qty <= 0}
              className="rounded-md bg-bull py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Buy / Long
            </button>
            <button
              onClick={() => orderMutation.mutate("short")}
              disabled={orderMutation.isPending || qty <= 0}
              className="rounded-md bg-bear py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Sell / Short
            </button>
          </div>

          <h3 className="mb-2 mt-6 text-xs uppercase tracking-widest text-muted-foreground">
            Related
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {related.map((i) => (
              <Link
                key={i.symbol}
                to="/terminal/$symbol"
                params={{ symbol: i.symbol }}
                className="flex items-center gap-1.5 rounded border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <AssetIcon symbol={i.symbol} size={14} />
                {displaySymbol(i.symbol)}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="hidden lg:block" />
        <TimedContractPanel symbol={symbol} balance={usdtBalance} />
      </div>

      <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
        Open positions · {displaySymbol(symbol)}
      </h2>
      <div className="panel mb-28 md:mb-10">
        <PositionsTable
          positions={openHere}
          quotes={quotes}
          emptyLabel="No open positions on this instrument."
        />
      </div>

      {/* Sticky one-handed execution controls (mobile) */}
      <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-40 border-t border-border bg-background/95 px-3 py-2 backdrop-blur-xl md:hidden">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{displaySymbol(symbol)}</span>
          <span className="num">{quote ? formatPrice(quote.price, symbol) : "—"}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => orderMutation.mutate("long")}
            disabled={orderMutation.isPending || qty <= 0}
            className="min-h-11 touch-manipulation rounded-xl bg-bull text-sm font-semibold text-bull-foreground disabled:opacity-40"
          >
            Buy / Long
          </button>
          <button
            onClick={() => orderMutation.mutate("short")}
            disabled={orderMutation.isPending || qty <= 0}
            className="min-h-11 touch-manipulation rounded-xl bg-bear text-sm font-semibold text-bear-foreground disabled:opacity-40"
          >
            Sell / Short
          </button>
        </div>
      </div>
    </AppShell>
  );
}
