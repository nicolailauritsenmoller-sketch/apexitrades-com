import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
} from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { useQuotes } from "@/hooks/useMarket";
import { displaySymbol, formatPrice } from "@/lib/instruments";
import { getWalletActivity } from "@/lib/wallet.functions";

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
  return (
    <div className="grid grid-cols-3 gap-2.5">
      <Link
        to="/wallet"
        search={{ tab: "deposit" }}
        className="flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]"
      >
        <ArrowDownToLine className="size-4" strokeWidth={2.6} />
        Add funds
      </Link>
      <Link
        to="/wallet"
        search={{ tab: "withdraw" }}
        className="flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-bear px-3 py-3 text-sm font-bold text-bear-foreground transition-transform active:scale-[0.97]"
      >
        <ArrowUpFromLine className="size-4" strokeWidth={2.6} />
        Withdraw
      </Link>
      <Link
        to="/trade"
        search={{ symbol: "BTCUSDT" }}
        className="flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-sm font-bold text-primary-foreground transition-transform active:scale-[0.97]"
      >
        <CandlestickChart className="size-4" strokeWidth={2.6} />
        Trade
      </Link>
    </div>
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
                    {q && !q.stale ? formatPrice(q.price, symbol) : "—"}
                  </div>
                  <div className={`num text-[11px] font-semibold ${up ? "text-bull" : "text-bear"}`}>
                    {q && !q.stale ? `${up ? "+" : ""}${chg.toFixed(2)}%` : "—"}
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

/* ----------------------------- Recent activity ---------------------------- */

type ActivityRow = {
  id: string;
  kind: "Deposit" | "Withdrawal" | "Swap";
  label: string;
  amount: string;
  status: string;
  createdAt: string;
  positive: boolean;
};

export function RecentActivitySection() {
  const fetchActivity = useServerFn(getWalletActivity);
  const activity = useQuery({
    queryKey: ["wallet-activity"],
    queryFn: () => fetchActivity(),
    refetchInterval: 30_000,
  });

  const rows: ActivityRow[] = [
    ...(activity.data?.deposits ?? []).map((d) => ({
      id: `d-${d.id}`,
      kind: "Deposit" as const,
      label: d.coin,
      amount: `+${d.amount} ${d.coin}`,
      status: d.status,
      createdAt: d.createdAt,
      positive: true,
    })),
    ...(activity.data?.withdrawals ?? []).map((w) => ({
      id: `w-${w.id}`,
      kind: "Withdrawal" as const,
      label: w.coin,
      amount: `-${w.amount} ${w.coin}`,
      status: w.status,
      createdAt: w.createdAt,
      positive: false,
    })),
    ...(activity.data?.swaps ?? []).map((s) => ({
      id: `s-${s.id}`,
      kind: "Swap" as const,
      label: `${s.fromCurrency} → ${s.toCurrency}`,
      amount: `${s.toAmount} ${s.toCurrency}`,
      status: "completed",
      createdAt: s.createdAt,
      positive: true,
    })),
  ]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 4);

  return (
    <section className="panel mt-4 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight">Recent activity</h2>
        <Link to="/wallet" search={{ tab: "deposit" }} className="text-xs font-semibold text-primary">
          View all
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">
          No transactions yet. Make your first deposit to get started.
        </p>
      ) : (
        <ul>
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 border-b border-border/60 py-3 last:border-0"
            >
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full ${
                  r.kind === "Swap"
                    ? "bg-primary/12 text-primary"
                    : r.positive
                      ? "bg-bull/12 text-bull"
                      : "bg-bear/12 text-bear"
                }`}
              >
                {r.kind === "Swap" ? (
                  <Repeat className="size-4" />
                ) : r.positive ? (
                  <ArrowDownLeft className="size-4" />
                ) : (
                  <ArrowUpRight className="size-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {r.kind} · {r.label}
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div
                  className={`num text-sm font-semibold ${r.positive ? "text-bull" : "text-bear"}`}
                >
                  {r.amount}
                </div>
                <div className="text-[11px] capitalize text-muted-foreground">{r.status}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
