import { useEffect, useMemo, useState } from "react";
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
import { TradeCloseSummary } from "@/components/TradeCloseSummary";
import { buildContractSummary, type TradeSummary } from "@/lib/trade-summary";

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
      toast.success(
        `Contract open at ${formatPrice(res.entryPrice, symbol)} · target profit ${formatMoney(res.expectedProfit, res.currency)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const settleMutation = useMutation({
    mutationFn: async (id: string) => ({ id, res: await settle({ data: { id } }) }),
    onSuccess: ({ id, res }) => {
      const c = (contracts.data ?? []).find((row) => row.id === id);
      if (c) {
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
            closedAt: new Date().toISOString(),
            balanceBefore: balance,
          }),
        );
      }
      if (res.result === "win") {
        toast.success(`Contract won · payout ${formatMoney(res.payout, res.currency)}`);
      } else if (res.result === "draw") {
        toast(`Contract drew · stake refunded`);
      } else {
        toast.error("Contract lost");
      }
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
  });

  const openContracts = useMemo(
    () => (contracts.data ?? []).filter((c) => c.status === "open"),
    [contracts.data],
  );
  const settled = useMemo(
    () => (contracts.data ?? []).filter((c) => c.status === "settled").slice(0, 5),
    [contracts.data],
  );

  const now = useNow(openContracts.length > 0);

  // Auto-settle expired contracts once their countdown reaches zero.
  useEffect(() => {
    for (const c of openContracts) {
      if (new Date(c.expiresAt).getTime() <= now && !settleMutation.isPending) {
        settleMutation.mutate(c.id);
        break;
      }
    }
  }, [now, openContracts, settleMutation]);

  const stake = Number(amount) || 0;
  const belowMin = stake < tier.minInvestment;
  const overBalance = balance != null && stake > balance;
  const expectedProfit = (stake * tier.profitPct) / 100;
  const disabled = belowMin || overBalance || placeMutation.isPending;

  return (
    <div className="panel p-4">
      {summary && (
        <TradeCloseSummary
          summary={summary}
          onClose={() => setSummary(null)}
          onTradeAgain={() => {
            setSummary(null);
            placeMutation.mutate(summary.side === "Long" ? "up" : "down");
          }}
          onReverse={() => {
            setSummary(null);
            placeMutation.mutate(summary.side === "Long" ? "down" : "up");
          }}
        />
      )}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Timer className="size-3.5" /> Timed scalp contract
        </h2>
        <span className="num text-xs text-muted-foreground">
          {balance != null ? formatMoney(balance, CONTRACT_CURRENCY) : "—"}
        </span>
      </div>

      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
        Duration
      </label>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {CONTRACT_TIERS.map((t) => (
          <button
            key={t.seconds}
            onClick={() => {
              setTier(t);
              if (Number(amount) < t.minInvestment) setAmount(String(t.minInvestment));
            }}
            className={`rounded px-1 py-1.5 text-[11px] leading-tight transition-colors ${
              tier.seconds === t.seconds
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span className="block font-semibold">{t.label}</span>
            <span className="num block opacity-80">+{t.profitPct}%</span>
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-md border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
        Minimum investment{" "}
        <span className="num text-foreground">
          {tier.minInvestment.toLocaleString("en-US")} {CONTRACT_CURRENCY}
        </span>{" "}
        · expected profit <span className="num text-bull">{tier.profitPct}%</span>
      </div>

      <label className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted-foreground">
        Investment ({CONTRACT_CURRENCY})
      </label>
      <input
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
          <dt className="text-muted-foreground">Expected profit</dt>
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
          className="flex items-center justify-center gap-1.5 rounded-md bg-bull py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <TrendingUp className="size-4" /> Higher
        </button>
        <button
          onClick={() => placeMutation.mutate("down")}
          disabled={disabled}
          className="flex items-center justify-center gap-1.5 rounded-md bg-bear py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <TrendingDown className="size-4" /> Lower
        </button>
      </div>

      {openContracts.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-xs uppercase tracking-widest text-muted-foreground">
            Running contracts
          </h3>
          <ul className="space-y-2">
            {openContracts.map((c) => (
              <ContractCard key={c.id} contract={c} now={now} />
            ))}
          </ul>
        </>
      )}

      {settled.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-xs uppercase tracking-widest text-muted-foreground">
            Recent settlements
          </h3>
          <ul className="space-y-1.5 text-xs">
            {settled.map((c) => (
              <li key={c.id} className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {c.displaySymbol} · {c.direction === "up" ? "Higher" : "Lower"}
                </span>
                <span
                  className={`num ${c.result === "win" ? "text-bull" : c.result === "loss" ? "text-bear" : ""}`}
                >
                  {c.result === "win" ? "+" : c.result === "loss" ? "-" : ""}
                  {formatMoney(
                    c.result === "win" ? (c.stake * c.payoutPct) / 100 : c.result === "loss" ? c.stake : 0,
                    c.currency,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ContractCard({ contract, now }: { contract: ContractRow; now: number }) {
  const left = new Date(contract.expiresAt).getTime() - now;
  const total = contract.durationSeconds * 1000;
  const progress = Math.min(100, Math.max(0, ((total - left) / total) * 100));
  const profit = (contract.stake * contract.payoutPct) / 100;

  return (
    <li className="rounded-md border border-border bg-surface p-2.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">
          {contract.displaySymbol}{" "}
          <span className={contract.direction === "up" ? "text-bull" : "text-bear"}>
            {contract.direction === "up" ? "Higher" : "Lower"}
          </span>
        </span>
        <span className="num tabular-nums">
          {left > 0 ? formatCountdown(left) : "Settling…"}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <CircularTimer progress={progress} label={left > 0 ? formatCountdown(left) : "…"} />
        <div className="min-w-0 flex-1 text-[11px] text-muted-foreground">
          <p className="num">
            Entry {formatPrice(contract.entryPrice, contract.symbol)}
          </p>
          <p className="num">{contract.durationSeconds}s contract</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="num">
          {formatMoney(contract.stake, contract.currency)} @{" "}
          {formatPrice(contract.entryPrice, contract.symbol)}
        </span>
        <span className="num text-bull">+{formatMoney(profit, contract.currency)}</span>
      </div>
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
