import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { Star, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { RestrictionBlock, useAccountLock } from "@/components/security/TraderLiveSync";
import { TradingViewChart, type ChartOverlay } from "@/components/trading/TradingViewChart";
import { getContracts } from "@/lib/contracts.functions";
import { TimedContractPanel } from "@/components/TimedContractPanel";
import { OrderBook } from "@/components/trading/OrderBook";
import { MobileOrderEntry } from "@/components/trading/MobileOrderEntry";
import { MobileTradeTabs } from "@/components/trading/MobileTradeTabs";
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
import { type Timeframe } from "@/lib/market-types";
import { TAKER_FEE_PCT } from "@/lib/limits";
import { usePreference } from "@/lib/preferences";

export const Route = createFileRoute("/_authenticated/terminal/$symbol")({
  loader: ({ params }) => {
    const inst = INSTRUMENT_MAP[params.symbol];
    if (!inst) throw notFound();
    return { name: inst.name, ticker: displaySymbol(inst.symbol) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Unavailable - Velocity Trade" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `${loaderData.ticker} scalping terminal - Velocity Trade`;
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
      {(error as Error).message}
    </div>
  ),
  notFoundComponent: () => (
    <div className="p-8 text-sm">
      Unknown instrument.{" "}
      <Link to="/markets" className="text-primary underline">
        Explore Markets
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
  const [leverage, setLeverage] = usePreference("orderLeverage", 1);
  const [orderConfirmations] = usePreference("orderConfirmations", true);
  // Price picked from the order book ladder; empty means execute at market.
  const [orderPriceValue, setOrderPriceValue] = useState("");
  const setOrderPrice = (p: number) => setOrderPriceValue(String(+p.toFixed(inst.precision)));

  const { quotes } = useQuotes([symbol], 1500);
  const quote = quotes[symbol];
  const candles = useCandles(symbol, timeframe);

  // Switching pair via Related/search: reset ticket parameters to the new instrument.
  useEffect(() => {
    setQuantity(String(inst.step));
    setOrderPriceValue("");
  }, [symbol, inst.step]);

  // Header mark price flash on each tick.
  const prevHeaderPrice = useRef<number | undefined>(undefined);
  const [headerFlash, setHeaderFlash] = useState<"" | "flash-up" | "flash-down">("");
  useEffect(() => {
    const p = quote?.price;
    if (p == null) return;
    const before = prevHeaderPrice.current;
    prevHeaderPrice.current = p;
    if (before == null || before === p) return;
    setHeaderFlash(p > before ? "flash-up" : "flash-down");
    const id = setTimeout(() => setHeaderFlash(""), 600);
    return () => clearTimeout(id);
  }, [quote?.price]);
  useEffect(() => {
    prevHeaderPrice.current = undefined;
  }, [symbol]);

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
    // Optimistic: flip the star immediately, roll back if the server rejects.
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["watchlist"] });
      const previous = queryClient.getQueryData<string[]>(["watchlist"]);
      queryClient.setQueryData<string[]>(["watchlist"], (old) => {
        const list = old ?? [];
        return list.includes(symbol) ? list.filter((s) => s !== symbol) : [...list, symbol];
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(["watchlist"], ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });


  const open = useServerFn(openPosition);
  const accountLock = useAccountLock();
  const orderMutation = useMutation({
    mutationFn: (vars: { side: "long" | "short"; quantity?: number }) =>
      open({
        data: {
          symbol,
          side: vars.side,
          quantity: vars.quantity ?? Number(quantity),
          leverage,
        },
      }),
    onSuccess: (res) => {
      toast.success(
        `Filled at ${formatPrice(res.entryPrice, symbol)} · margin ${formatMoney(res.margin, res.currency)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submitOrder(side: "long" | "short", requestedQuantity?: number) {
    if (accountLock.data?.tradingFrozen) {
      toast.error("Trading is frozen on this account. Contact support for details.");
      return;
    }
    const orderQuantity = requestedQuantity ?? Number(quantity);
    if (
      orderConfirmations &&
      !window.confirm(
        `Confirm ${side === "long" ? "Buy / Long" : "Sell / Short"} order\n\n${displaySymbol(symbol)} · ${orderQuantity} · ${leverage}x leverage`,
      )
    ) {
      return;
    }
    orderMutation.mutate({ side, quantity: orderQuantity });
  }

  const positions = (portfolio.data?.positions ?? []) as PositionRow[];
  const openHere = positions.filter((p) => p.status === "open" && p.symbol === symbol);
  const fetchContractsForChart = useServerFn(getContracts);
  const chartContracts = useQuery({ queryKey: ["contracts"], queryFn: () => fetchContractsForChart(), refetchInterval: 15_000 });
  const chartOverlays = useMemo<ChartOverlay[]>(() => {
    const out: ChartOverlay[] = [];
    for (const p of openHere) {
      const long = p.side === "long";
      out.push({ price: p.entryPrice, label: "Entry", tone: long ? "bull" : "bear", style: "dotted" });
      if (p.leverage > 1) {
        const liq = long ? p.entryPrice * (1 - 1 / p.leverage) : p.entryPrice * (1 + 1 / p.leverage);
        out.push({ price: liq, label: "Liq:", tone: "bear", style: "dashed" });
      }
    }
    for (const c of chartContracts.data ?? []) {
      if (c.status !== "open" || c.symbol !== symbol) continue;
      out.push({ price: c.entryPrice, label: "Strike", tone: c.direction === "up" ? "bull" : "bear", style: "dotted" });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openHere.map((p) => `${p.id}:${p.entryPrice}:${p.leverage}`).join("|"), chartContracts.data, symbol]);
  const wallets = portfolio.data?.wallets ?? [];
  const wallet = wallets.find((w) => w.currency === inst.currency);
  const usdtBalance = wallets.find((w) => w.currency === "USDT")?.balance;
  const qty = Number(quantity) || 0;
  const selectedPrice = Number(orderPriceValue) || 0;
  const price = selectedPrice > 0 ? selectedPrice : quote?.price;
  const notional = (price ?? 0) * qty;
  const margin = notional / leverage;
  // Maintenance margin of 0.5% of notional; liquidation is where equity runs out.
  const MAINTENANCE = 0.005;
  const liqLong = price && qty > 0 ? price * (1 - 1 / leverage + MAINTENANCE) : null;
  const liqShort = price && qty > 0 ? price * (1 + 1 / leverage - MAINTENANCE) : null;
  const insufficientMargin = margin > 0 && wallet != null && margin > wallet.balance;
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



  const formatVolume = (n?: number) => {
    if (n == null || n === 0) return "-";
    if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
    return n.toFixed(2);
  };

  return (
    <AppShell>
      <div className="w-full max-w-full overflow-x-hidden">
      <div className="mb-4 flex w-full max-w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <AssetIcon symbol={symbol} size={30} />
              <h1 className="truncate text-xl font-bold sm:text-2xl">{displaySymbol(symbol)}</h1>
              <button
                onClick={() => toggleMutation.mutate()}
                aria-label="Toggle watchlist"
                className="shrink-0 touch-manipulation text-muted-foreground transition-colors hover:text-primary"
              >
                <Star className={`size-4 ${starred ? "fill-primary text-primary" : ""}`} />
              </button>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {inst.name} · {ASSET_CLASS_LABEL[inst.assetClass]} · settles in {inst.currency}
            </p>
          </div>
          <div className="min-w-0">
            <div className={`num rounded px-1 text-xl font-semibold sm:text-2xl ${headerFlash}`}>
              {quote ? formatPrice(quote.price, symbol) : "-"}
            </div>
            <div className={`num flex items-center gap-1 text-xs ${up ? "text-bull" : "text-bear"}`}>
              {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
              {quote ? `${quote.change.toFixed(2)} (${quote.changePercent.toFixed(2)}%)` : "-"}
            </div>
          </div>
          <div className="hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground sm:flex">
            <div>
              <span className="block text-[10px] uppercase tracking-wider">24h High</span>
              <span className="num text-foreground">{quote ? formatPrice(quote.high, symbol) : "-"}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider">24h Low</span>
              <span className="num text-foreground">{quote ? formatPrice(quote.low, symbol) : "-"}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wider">24h Volume</span>
              <span className="num text-foreground">{formatVolume(quote?.volume)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid w-full max-w-full gap-4 xl:grid-cols-[minmax(0,1fr)_260px_340px] lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="panel min-w-0 max-w-full overflow-hidden p-0">
          <TradingViewChart
            symbol={symbol}
            candles={liveCandles}
            quote={quote}
            timeframe={timeframe}
            onTimeframeChange={setTimeframe}
            height={420}
            isLoading={candles.isLoading}
            overlays={chartOverlays}
          />
        </div>

        <div className="hidden min-w-0 max-w-full lg:col-span-2 lg:block xl:col-span-1">
          <OrderBook symbol={symbol} quote={quote} onSelectPrice={setOrderPrice} />
        </div>



        <div className="panel hidden min-w-0 max-w-full overflow-y-auto p-4 lg:block lg:max-h-[calc(100vh-9rem)]">

          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <AssetIcon symbol={symbol} size={18} />
              Order ticket
            </h2>
            <span className="num text-xs text-muted-foreground">
              {wallet ? formatMoney(wallet.balance, wallet.currency) : "-"}
            </span>
          </div>

          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Price
            </label>
            <button
              onClick={() => setOrderPriceValue("")}
              className="text-[10px] uppercase tracking-wider text-primary"
            >
              Market
            </button>
          </div>
          <input
            value={orderPriceValue}
            onChange={(e) => setOrderPriceValue(e.target.value)}
            inputMode="decimal"
            placeholder={quote ? formatPrice(quote.price, symbol) : "Market"}
            aria-label="Order price"
            className="num mb-3 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm outline-none focus:border-ring"
          />

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
                className="num flex-1 rounded border border-border py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                className={`num flex-1 rounded py-1 text-xs transition-colors ${
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
              <dd className={`num ${insufficientMargin ? "text-bear" : ""}`}>
                {formatMoney(margin, inst.currency)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Est. liquidation · long</dt>
              <dd className="num text-bear">
                {liqLong != null ? formatPrice(liqLong, symbol) : "-"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Est. liquidation · short</dt>
              <dd className="num text-bear">
                {liqShort != null ? formatPrice(liqShort, symbol) : "-"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">
                Est. trading fee ({(TAKER_FEE_PCT * 100).toFixed(2)}%)
              </dt>
              <dd className="num">{formatMoney(notional * TAKER_FEE_PCT, inst.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total cost</dt>
              <dd className="num font-semibold">
                {formatMoney(margin + notional * TAKER_FEE_PCT, inst.currency)}
              </dd>
            </div>
            {insufficientMargin && (
              <p className="pt-1 text-[11px] text-bear">
                Margin exceeds your {inst.currency} balance of{" "}
                {formatMoney(wallet?.balance ?? 0, inst.currency)}.
              </p>
            )}
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => submitOrder("long")}
              disabled={orderMutation.isPending || qty <= 0}
              className="min-h-11 touch-manipulation rounded-xl bg-bull text-sm font-semibold text-bull-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Buy Long
            </button>
            <button
              onClick={() => submitOrder("short")}
              disabled={orderMutation.isPending || qty <= 0}
              className="min-h-11 touch-manipulation rounded-xl bg-bear text-sm font-semibold text-bear-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Sell Short
            </button>
          </div>

          <h3 className="mb-2 mt-6 text-xs uppercase tracking-widest text-muted-foreground">
            Related
          </h3>
          <div className="flex max-w-full flex-wrap gap-1.5">
            {related.map((i) => (
              <Link
                key={i.symbol}
                to="/terminal/$symbol"
                params={{ symbol: i.symbol }}
                className="flex min-w-0 touch-manipulation items-center gap-1.5 rounded-lg border border-border px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <AssetIcon symbol={i.symbol} size={14} />
                <span className="truncate">{displaySymbol(i.symbol)}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 lg:hidden">
        <RestrictionBlock kind="trading">
          <MobileOrderEntry
            symbol={symbol}
            price={quote?.price}
            balance={wallet?.balance}
            orderPrice={orderPriceValue}
            onOrderPriceChange={setOrderPriceValue}
            onSubmit={(side, q) => submitOrder(side, q)}
            pending={orderMutation.isPending}
          />
        </RestrictionBlock>
        <OrderBook symbol={symbol} quote={quote} onSelectPrice={setOrderPrice} compact />
      </div>

      <div className="mt-4 grid w-full max-w-full gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="hidden lg:block" />
        <div className="min-w-0 max-w-full">
          <RestrictionBlock kind="trading"><TimedContractPanel symbol={symbol} balance={usdtBalance} /></RestrictionBlock>
        </div>
      </div>

      <div className="mb-10 lg:hidden">
        <MobileTradeTabs
          openPositions={positions.filter((p) => p.status === "open")}
          orders={openHere}
          history={positions.filter((p) => p.status !== "open")}
          wallets={wallets}
          quotes={quotes}
        />
      </div>

      <div className="hidden lg:block">
        <h2 className="mb-3 mt-8 text-xs uppercase tracking-widest text-muted-foreground">
          Open positions · {displaySymbol(symbol)}
        </h2>
        <div className="panel mb-10 w-full max-w-full overflow-x-auto">
          <PositionsTable
            positions={openHere}
            quotes={quotes}
            emptyLabel="No open positions on this instrument."
          />
        </div>
      </div>
      </div>
    </AppShell>
  );
}
