import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ChevronRight,
} from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const WATCH = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT"] as const;
const MOVERS = [
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "MATICUSDT",
  "LINKUSDT",
] as const;

/* --------------------------------- Actions -------------------------------- */

export function HomeActionBar() {
  const [fundingOpen, setFundingOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setFundingOpen(true)}
          className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl bg-yellow-400 px-3 py-0 text-sm font-semibold text-black transition-transform active:scale-[0.97]"
        >
          <ArrowDownToLine className="size-4" strokeWidth={2.6} />
          Add funds
        </button>
        <Link
          to="/wallet"
          search={{ tab: "withdraw" }}
          className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-0 text-sm font-semibold text-red-400 transition-transform hover:bg-red-500/30 active:scale-[0.97]"
        >
          <ArrowUpFromLine className="size-4" strokeWidth={2.6} />
          Withdraw
        </Link>
        <Link
          to="/trade"
          search={{ symbol: "BTCUSDT" }}
          className="flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-0 text-sm font-semibold text-white transition-transform hover:bg-zinc-700/80 active:scale-[0.97]"
        >
          <CandlestickChart className="size-4" strokeWidth={2.6} />
          Trade
        </Link>
      </div>

      <Drawer open={fundingOpen} onOpenChange={setFundingOpen}>
        <DrawerContent className="mx-auto max-w-xl pb-[env(safe-area-inset-bottom)]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Add funds</DrawerTitle>
            <DrawerDescription>Choose how you want to fund your account.</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <Link
              to="/wallet"
              search={{ tab: "deposit" }}
              onClick={() => setFundingOpen(false)}
              className="flex touch-manipulation items-center gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/60 hover:bg-surface-raised"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <ArrowDownToLine className="size-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Crypto transfer</span>
                <span className="block text-xs text-muted-foreground">Deposit crypto from another wallet</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

/* -------------------------------- Watchlist ------------------------------- */

export function WatchlistSection() {
  const { quotes } = useQuotes([...WATCH], 6000);

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight">Watchlist</h2>
        <Link to="/markets" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>
      <ul>
        {WATCH.map((symbol) => {
          const q = quotes[symbol];
          const chg = q?.changePercent ?? 0;
          const up = chg >= 0;
          return (
            <li key={symbol}>
              <Link
                to="/terminal/$symbol"
                params={{ symbol }}
                className="flex touch-manipulation items-center gap-3 border-b border-border/60 py-3 last:border-0"
              >
                <AssetIcon symbol={symbol} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{displaySymbol(symbol)}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {symbol.replace("USDT", "")}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="num text-sm font-semibold">
                    {q && !q.stale ? formatPrice(q.price, symbol) : "-"}
                  </div>
                  <div className={`num text-[11px] font-semibold ${up ? "text-bull" : "text-bear"}`}>
                    {q && !q.stale ? `${up ? "+" : ""}${chg.toFixed(2)}%` : "-"}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ------------------------------- Top movers ------------------------------- */

export function TopMoversSection() {
  const { quotes } = useQuotes([...MOVERS], 8000);
  const rows = MOVERS.map((s) => ({ symbol: s, chg: quotes[s]?.changePercent ?? 0 })).sort(
    (a, b) => b.chg - a.chg,
  );
  const gainers = rows.slice(0, 3);
  const losers = rows.slice(-3).reverse();

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      <MoverCard title="Top gainers" rows={gainers} tone="bull" />
      <MoverCard title="Top losers" rows={losers} tone="bear" />
    </div>
  );
}

function MoverCard({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: { symbol: string; chg: number }[];
  tone: "bull" | "bear";
}) {
  return (
    <div className="panel p-3">
      <h3 className={`mb-2 text-xs font-bold ${tone === "bull" ? "text-bull" : "text-bear"}`}>
        {title}
      </h3>
      <ul className="space-y-2">
        {rows.map(({ symbol, chg }) => (
          <li key={symbol}>
            <Link
              to="/terminal/$symbol"
              params={{ symbol }}
              className="flex touch-manipulation items-center gap-2"
            >
              <AssetIcon symbol={symbol} size={18} />
              <span className="min-w-0 flex-1 truncate text-[11px] font-medium">
                {displaySymbol(symbol)}
              </span>
              <span
                className={`num shrink-0 text-[11px] font-semibold ${chg >= 0 ? "text-bull" : "text-bear"}`}
              >
                {chg >= 0 ? "+" : ""}
                {chg.toFixed(2)}%
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

