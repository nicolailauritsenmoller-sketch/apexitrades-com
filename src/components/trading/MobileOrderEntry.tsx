import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Info, Plus } from "lucide-react";
import { INSTRUMENT_MAP, displaySymbol, formatMoney } from "@/lib/instruments";
import { TAKER_FEE_PCT } from "@/lib/limits";

/**
 * Binance-style mobile order entry: buy/sell tabs, order type, amount with a
 * currency switch, percentage stepper, and the account summary rows.
 */
export function MobileOrderEntry({
  symbol,
  price,
  balance,
  orderPrice,
  onOrderPriceChange,
  onSubmit,
  pending,
}: {
  symbol: string;
  price?: number;
  balance?: number;
  orderPrice: string;
  onOrderPriceChange: (v: string) => void;
  onSubmit: (side: "long" | "short", quantity: number) => void;
  pending?: boolean;
}) {
  const inst = INSTRUMENT_MAP[symbol];
  const base = displaySymbol(symbol).split("/")[0] ?? symbol;
  const quoteCcy = inst?.currency ?? "USDT";

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"quote" | "base">("quote");
  const [slippage, setSlippage] = useState(true);

  const effectivePrice = orderType === "limit" ? Number(orderPrice) || price : price;
  const amt = Number(amount) || 0;
  const qty = unit === "quote" ? (effectivePrice ? amt / effectivePrice : 0) : amt;
  const notional = qty * (effectivePrice ?? 0);
  const fee = notional * TAKER_FEE_PCT;
  const maxBuy = effectivePrice && balance ? balance / effectivePrice : 0;

  const setPct = (pct: number) => {
    if (!balance) return;
    const quoteAmount = (balance * pct) / 100;
    setAmount(
      unit === "quote"
        ? String(+quoteAmount.toFixed(2))
        : String(+(effectivePrice ? quoteAmount / effectivePrice : 0).toFixed(6)),
    );
  };

  const buy = side === "buy";

  return (
    <div className="panel flex min-w-0 flex-col gap-3 p-3">
      <div className="grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            aria-pressed={side === s}
            className={`min-h-9 touch-manipulation rounded-md text-xs font-semibold uppercase transition-colors ${
              side === s
                ? s === "buy"
                  ? "bg-bull text-bull-foreground"
                  : "bg-bear text-bear-foreground"
                : "text-muted-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <select
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as "market" | "limit")}
          aria-label="Order type"
          className="min-h-9 flex-1 rounded-md border border-border bg-surface px-2 text-xs outline-none focus:border-ring"
        >
          <option value="market">Market</option>
          <option value="limit">Limit</option>
        </select>
        <span
          title="Market fills at the best available price. Limit uses the price you pick from the order book."
          className="text-muted-foreground"
        >
          <Info className="size-3.5" />
        </span>
      </div>

      {orderType === "limit" && (
        <input
          value={orderPrice}
          onChange={(e) => onOrderPriceChange(e.target.value)}
          inputMode="decimal"
          aria-label="Limit price"
          placeholder={price ? String(price) : "Price"}
          className="num min-h-10 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus:border-ring"
        />
      )}

      <div className="flex items-center rounded-md border border-input bg-surface">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label="Amount"
          placeholder="Amount"
          className="num min-h-10 w-full min-w-0 bg-transparent px-3 text-sm outline-none"
        />
        <select
          value={unit}
          onChange={(e) => setUnit(e.target.value as "quote" | "base")}
          aria-label="Amount currency"
          className="min-h-10 shrink-0 bg-transparent pr-2 text-xs text-muted-foreground outline-none"
        >
          <option value="quote">{quoteCcy}</option>
          <option value="base">{base}</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {[25, 50, 75, 100].map((p) => (
          <button
            key={p}
            onClick={() => setPct(p)}
            className="min-h-8 touch-manipulation rounded border border-border text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {p}%
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={slippage}
          onChange={(e) => setSlippage(e.target.checked)}
          className="size-3.5 accent-[var(--primary)]"
        />
        Slippage tolerance
      </label>

      <dl className="space-y-1.5 border-t border-border pt-2 text-[11px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Available</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <span className="num truncate">{formatMoney(balance ?? 0, quoteCcy)}</span>
            <Link
              to="/wallet"
              aria-label="Deposit funds"
              className="grid size-5 shrink-0 place-items-center rounded bg-primary text-primary-foreground"
            >
              <Plus className="size-3" />
            </Link>
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Max {buy ? "buy" : "sell"}</dt>
          <dd className="num">
            {maxBuy.toFixed(6)} {base}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Est. fee</dt>
          <dd className="num">{formatMoney(fee, quoteCcy)}</dd>
        </div>
      </dl>

      <button
        onClick={() => onSubmit(buy ? "long" : "short", qty)}
        disabled={pending || qty <= 0}
        className={`min-h-11 w-full touch-manipulation rounded-xl text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 ${
          buy ? "bg-bull text-bull-foreground" : "bg-bear text-bear-foreground"
        }`}
      >
        {buy ? "Buy" : "Sell"} {base}
      </button>
    </div>
  );
}
