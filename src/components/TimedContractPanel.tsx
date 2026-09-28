import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Timer, TrendingUp, TrendingDown } from "lucide-react";
import {
  getContracts,
  placeContract,
  settleContract,
  type ContractRow,
} from "@/lib/contracts.functions";
import {
  CONTRACT_CURRENCY,
  CONTRACT_TIERS,
  formatCountdown,
  type ContractTier,
} from "@/lib/contract-tiers";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { AssetIcon } from "@/lib/asset-icons";
import { TradeCloseSummary } from "@/components/TradeCloseSummary";
import { buildContractSummary, type TradeSummary } from "@/lib/trade-summary";
import { LivePnl } from "@/components/LivePnl";
import { useQuotes } from "@/hooks/useMarket";
import { logActivity } from "@/lib/telemetry";

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function TimedContractPanel({
  symbol,
  balance,
}: {
  symbol: string;
  balance?: number;
}) {
  const queryClient = useQueryClient();
  const [tier, setTier] = useState<ContractTier>(CONTRACT_TIERS[0]);
  const [amount, setAmount] = useState(String(CONTRACT_TIERS[0].minInvestment));
  const [summary, setSummary] = useState<TradeSummary | null>(null);

  const fetchContracts = useServerFn(getContracts);
  const contracts = useQuery({
    queryKey: ["contracts"],
    queryFn: () => fetchContracts(),
    refetchInterval: 15_000,
  });

  const place = useServerFn(placeContract);
  const settle = useServerFn(settleContract);

  const placeMutation = useMutation({
    mutationFn: (direction: "up" | "down") =>
      place({ data: { symbol, direction, stake: Number(amount), durationSeconds: tier.seconds } }),
    onSuccess: (res) => {
      void logActivity("order", `Opened ${symbol} scalp contract`, { symbol, stake: Number(amount) });
      toast.success(
        `Contract open at ${formatPrice(res.entryPrice, symbol)} · estimated return ${formatMoney(res.expectedProfit, res.currency)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amountRef = useRef<HTMLInputElement>(null);
  const [listTab, setListTab] = useState<"running" | "settled">("running");

  // Single-trigger guard: each settled contract opens the modal at most once, across refreshes.
  const SHOWN_KEY = "velocity:contract-summary-shown";
  const wasShown = (id: string) => {
    try {
      return (JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]).includes(id);
    } catch {
      return false;
    }
  };
  const markShown = (id: string) => {
    try {
      const ids = (JSON.parse(localStorage.getItem(SHOWN_KEY) ?? "[]") as string[]).filter((x) => x !== id);
      ids.push(id);
      localStorage.setItem(SHOWN_KEY, JSON.stringify(ids.slice(-200)));
    } catch {
      /* storage unavailable */
    }
  };

  const showSettled = (
    c: ContractRow,
    res: { result: "win" | "loss" | "draw"; exitPrice: number; payout: number; currency: string },
    closedAt?: string | null,
  ) => {
    if (wasShown(c.id)) return;
    markShown(c.id);
    setSummary(
      buildContractSummary({
        id: c.id,
        symbol: c.symbol,
        displaySymbol: c.displaySymbol,
        direction: c.direction,
        stake: c.stake,
        currency: res.currency,
        entryPrice: c.entryPrice,
        exitPrice: res.exitPrice,
        payout: res.payout,
        result: res.result,
        openedAt: c.openedAt,
        closedAt: closedAt ?? new Date().toISOString(),
        balanceBefore: balance,
      }),
    );
    if (res.result === "win") {
      toast.success(`Contract closed · payout ${formatMoney(res.payout, res.currency)}`);
    } else if (res.result === "draw") {
      toast(`Contract closed · stake refunded`);
    } else {
      toast.error(`Contract closed · -${formatMoney(c.stake, res.currency)}`);
    }
  };

  const settlingRef = useRef<Set<string>>(new Set());
  const settleMutation = useMutation({
    mutationFn: async (id: string) => ({ id, res: await settle({ data: { id } }) }),
    onSuccess: ({ id, res }) => {
      const c = (contracts.data ?? []).find((row) => row.id === id);
      if (c) showSettled(c, res);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (_e, id) => {
      // Retry shortly instead of leaving the card stuck on "Settling...".
      setTimeout(() => settlingRef.current.delete(id), 1000);
    },
  });

  // Contracts seen running in this view; if the background sweep settles one, still show its summary.
  const seenOpenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const c of contracts.data ?? []) {
      if (c.status === "open") seenOpenRef.current.add(c.id);
      else if (c.status === "settled" && seenOpenRef.current.has(c.id) && c.result && c.exitPrice != null) {
        seenOpenRef.current.delete(c.id);
        showSettled(
          c,
          { result: c.result as "win" | "loss" | "draw", exitPrice: c.exitPrice, payout: c.payout ?? 0, currency: c.currency },
          c.settledAt,
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts.data]);

  const openContracts = useMemo(
    () => (contracts.data ?? []).filter((c) => c.status === "open"),
    [contracts.data],
  );
  const settledContracts = useMemo(
    () => (contracts.data ?? []).filter((c) => c.status === "settled"),
    [contracts.data],
  );

  const now = useNow(openContracts.length > 0);
  const { quotes } = useQuotes(
    useMemo(() => Array.from(new Set(openContracts.map((c) => c.symbol))), [openContracts]),
    1000,
  );

  // Settle the instant the countdown hits zero (precise per-contract timers, not the 1s tick).
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const c of openContracts) {
      if (settlingRef.current.has(c.id)) continue;
      const wait = Math.max(0, new Date(c.expiresAt).getTime() - Date.now());
      timers.push(
        setTimeout(() => {
          if (settlingRef.current.has(c.id)) return;
          settlingRef.current.add(c.id);
          settleMutation.mutate(c.id);
        }, wait),
      );
    }
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openContracts, now]);

  const stake = Number(amount) || 0;
  const belowMin = stake < tier.minInvestment;
  const overBalance = balance != null && stake > balance;
  const expectedProfit = (stake * tier.profitPct) / 100;
  const disabled = belowMin || overBalance || placeMutation.isPending;

  return (
    <div className="panel overflow-hidden border border-border bg-card p-0">
      {summary && (
        <TradeCloseSummary
          summary={summary}
          onClose={() => setSummary(null)}
          onTradeAgain={() => {
            setSummary(null);
            setTimeout(() => {
              amountRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
              amountRef.current?.focus();
              amountRef.current?.select();
            }, 50);
          }}
          onViewHistory={() => {
            setSummary(null);
            setListTab("settled");
          }}
        />
      )}

      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-foreground">
          <Timer className="size-3.5 text-primary" /> Scalping
        </h2>
        <span className="num text-xs text-muted-foreground">
          {balance != null ? formatMoney(balance, CONTRACT_CURRENCY) : "-"}
        </span>
      </div>

      <div className="px-4 py-3">
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Duration
        </label>
        <div className="mb-3 flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {CONTRACT_TIERS.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setTier(t);
                if (Number(amount) < t.minInvestment) setAmount(String(t.minInvestment));
              }}
              className={`min-w-[3.25rem] flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors sm:flex-none sm:px-3 ${
                tier.id === t.id
                  ? "bg-surface-raised text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          Min. investment{" "}
          <span className="num text-foreground">
            {tier.minInvestment.toLocaleString("en-US")} {CONTRACT_CURRENCY}
          </span>
          <span className="mx-1.5 text-border">|</span>
          Est. return{" "}
          <span className="num text-bull">{tier.profitPct}%</span>
          <span className="mx-1.5 text-border">|</span>
          Est. payout{" "}
          <span className="num text-foreground">
            +{formatMoney(expectedProfit, CONTRACT_CURRENCY)}
          </span>
        </div>

        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Investment ({CONTRACT_CURRENCY})
        </label>
        <input
          ref={amountRef}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-invalid={belowMin || overBalance}
          className={`num mb-2 w-full rounded-md border bg-surface px-3 py-2 text-sm outline-none focus:border-ring ${
            belowMin || overBalance ? "border-bear" : "border-input"
          }`}
        />
        {belowMin && (
          <p role="alert" className="mb-2 text-[11px] text-bear">
            Amount is below the {tier.label} minimum of{" "}
            {tier.minInvestment.toLocaleString("en-US")} {CONTRACT_CURRENCY}.
          </p>
        )}
        {!belowMin && overBalance && (
          <p role="alert" className="mb-2 text-[11px] text-bear">
            Not enough {CONTRACT_CURRENCY} balance for this contract.
          </p>
        )}

        <dl className="mb-3 space-y-1.5 border-t border-border pt-3 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Estimated return</dt>
            <dd className="num text-bull">+{formatMoney(expectedProfit, CONTRACT_CURRENCY)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Payout on win</dt>
            <dd className="num">{formatMoney(stake + expectedProfit, CONTRACT_CURRENCY)}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-2">
        <button
            onClick={() => placeMutation.mutate("up")}
            disabled={disabled}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-bull py-2.5 text-sm font-semibold text-bull-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <TrendingUp className="size-4" /> Buy / Long
          </button>
          <button
            onClick={() => placeMutation.mutate("down")}
            disabled={disabled}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-bear py-2.5 text-sm font-semibold text-bear-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            <TrendingDown className="size-4" /> Sell / Short
          </button>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="mb-2 flex gap-1 rounded-lg border border-border p-1 text-[11px] font-semibold uppercase tracking-wider">
          {(["running", "settled"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setListTab(t)}
              className={`flex-1 touch-manipulation rounded-md px-2 py-1.5 ${
                listTab === t ? "bg-surface-raised text-foreground" : "text-muted-foreground"
              }`}
            >
              {t === "running" ? `Running Contracts (${openContracts.length})` : `Settled Contracts (${settledContracts.length})`}
            </button>
          ))}
        </div>
        {listTab === "running" ? (
          openContracts.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">No running contracts.</p>
          ) : (
            <ul className="space-y-2">
              {openContracts.map((c) => (
                <ContractCard key={c.id} contract={c} now={now} mark={quotes[c.symbol]?.price} />
              ))}
            </ul>
          )
        ) : settledContracts.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No settled contracts yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {settledContracts.map((c) => (
              <SettledCard key={c.id} contract={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ContractCard({
  contract,
  now,
  mark,
}: {
  contract: ContractRow;
  now: number;
  mark?: number;
}) {
  const left = new Date(contract.expiresAt).getTime() - now;
  const total = contract.durationSeconds * 1000;
  const progress = Math.min(100, Math.max(0, ((total - left) / total) * 100));
  const profit = (contract.stake * contract.payoutPct) / 100;
  const expired = left <= 0;
  // Dynamic unrealized P/L, always on the contract's financial scale: a move in
  // favor ramps smoothly from 0 to the full expected payout, an adverse move
  // ramps from 0 to the full stake at risk. Normalized against the payout
  // percentage so raw spot deltas never surface as the P/L figure.
  const livePnl = (() => {
    if (mark == null || contract.entryPrice <= 0) return null;
    const move = (mark - contract.entryPrice) / contract.entryPrice;
    const signed = contract.direction === "up" ? move : -move;
    if (signed === 0) return 0;
    // A relative move equal to the payout % reaches full payout / full loss.
    const scale = contract.payoutPct > 0 ? contract.payoutPct / 100 : 0.1;
    const progress = Math.min(1, Math.abs(signed) / scale);
    return signed > 0 ? profit * progress : -contract.stake * progress;
  })();

  const sideLabel = contract.direction === "up" ? "Buy / Long" : "Sell / Short";
  const sideClass = contract.direction === "up" ? "text-bull" : "text-bear";

  return (
    <li className="rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-medium">
          <AssetIcon symbol={contract.symbol} size={18} />
          <span className="truncate">{contract.displaySymbol}</span>{" "}
          <span className={sideClass}>{sideLabel}</span>
        </span>
        <span className="num tabular-nums">
          {left > 0 ? formatCountdown(left) : "Settling..."}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-3">
        <CircularTimer progress={progress} label={left > 0 ? formatCountdown(left) : "..."} />
        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          <p className="num">
            Entry {formatPrice(contract.entryPrice, contract.symbol)}
          </p>
          <p className="num">{contract.durationSeconds}s contract</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="num truncate">
          {formatMoney(contract.stake, contract.currency)} @{" "}
          {formatPrice(contract.entryPrice, contract.symbol)}
          {mark != null && <> · mark {formatPrice(mark, contract.symbol)}</>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <span className="uppercase tracking-wider">{expired ? "Final" : "Live P/L"}</span>
          <LivePnl value={livePnl} currency={contract.currency} live={!expired} />
        </span>
      </div>
    </li>
  );
}

function SettledCard({ contract: c }: { contract: ContractRow }) {
  const pnl = (c.payout ?? 0) - c.stake;
  const win = c.result === "win";
  const loss = c.result === "loss";
  const delta = c.exitPrice != null ? c.exitPrice - c.entryPrice : null;
  const deltaPct = delta != null && c.entryPrice ? (delta / c.entryPrice) * 100 : null;
  const tone = win ? "border-bull/40 bg-bull/5" : loss ? "border-bear/40 bg-bear/5" : "border-border bg-surface";
  const row = (k: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="num truncate text-right">{v}</dd>
    </div>
  );
  return (
    <li className={`rounded-md border p-2.5 text-[11px] ${tone}`}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <AssetIcon symbol={c.symbol} size={16} />
          {c.displaySymbol}
          <span className={c.direction === "up" ? "text-bull" : "text-bear"}>
            {c.direction === "up" ? "Buy / Long" : "Sell / Short"}
          </span>
        </span>
        <span className={`num font-bold ${win ? "text-bull" : loss ? "text-bear" : "text-muted-foreground"}`}>
          {win
            ? `+${pnl.toFixed(2)} ${c.currency}`
            : loss
              ? `-${c.stake.toFixed(2)} ${c.currency} (-100%)`
              : `0.00 ${c.currency} (Refund)`}
        </span>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-2">
        {row("Contract ID", c.id.slice(0, 8).toUpperCase())}
        {row("Duration", `${c.durationSeconds}s`)}
        {row("Entry Price", formatPrice(c.entryPrice, c.symbol))}
        {row("Settlement Price", c.exitPrice != null ? formatPrice(c.exitPrice, c.symbol) : "-")}
        {row(
          "Mark Delta",
          delta != null ? `${delta >= 0 ? "+" : "-"}${formatPrice(Math.abs(delta), c.symbol)} (${deltaPct! >= 0 ? "+" : "-"}${Math.abs(deltaPct!).toFixed(3)}%)` : "-",
        )}
        {row("Investment", formatMoney(c.stake, c.currency))}
        {row("Settled", c.settledAt ? new Date(c.settledAt).toLocaleString() : "-")}
      </dl>
    </li>
  );
}


function CircularTimer({ progress, label }: { progress: number; label: string }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(1, Math.max(0, progress / 100)));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Time remaining ${label}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="num absolute inset-0 grid place-items-center text-[10px] font-semibold tabular-nums">
        {label}
      </span>
    </div>
  );
}
