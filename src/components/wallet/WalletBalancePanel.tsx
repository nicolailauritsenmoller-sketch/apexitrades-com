import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Repeat, Search } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { assetName } from "@/lib/transactions";
import { BalancePrivacyToggle } from "@/lib/balance-privacy";
import type { AssetHolding } from "@/components/AssetsOverview";

function fmt(value: number, digits = 2) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function qty(value: number, currency: string) {
  return fmt(value, currency === "BTC" || currency === "ETH" ? 6 : 2);
}

const ACTIONS = [
  {
    id: "deposit",
    label: "Add funds",
    icon: ArrowDownToLine,
    className:
      "bg-yellow-400 text-black font-semibold hover:bg-yellow-300 active:scale-[0.97]",
  },
  {
    id: "withdraw",
    label: "Withdraw",
    icon: ArrowUpFromLine,
    className:
      "border border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-[0.97]",
  },
  {
    id: "swap",
    label: "Swap",
    icon: Repeat,
    className:
      "border border-zinc-700 bg-zinc-800/80 text-white hover:bg-zinc-700/80 active:scale-[0.97]",
  },
] as const;

export type WalletAction = (typeof ACTIONS)[number]["id"];

/**
 * Coinbase-style wallet header: total balance card with privacy eye, the
 * three primary money-movement actions, and the searchable asset balance list.
 */
export function WalletBalancePanel({
  holdings,
  totalUsdt,
  isLoading,
  active,
  onSelect,
  hidden,
  onTogglePrivacy,
}: {
  holdings: AssetHolding[];
  totalUsdt: number;
  isLoading?: boolean;
  active: WalletAction;
  onSelect: (id: WalletAction) => void;
  hidden: boolean;
  onTogglePrivacy: () => void;
}) {
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return holdings
      .filter((h) => (hideZero ? h.balance > 0 : true))
      .filter(
        (h) =>
          !term ||
          h.currency.toLowerCase().includes(term) ||
          assetName(h.currency).toLowerCase().includes(term),
      )
      .sort((a, b) => b.valueUsdt - a.valueUsdt);
  }, [holdings, hideZero, search]);

  return (
    <div className="space-y-4">
      <section className="panel touch-manipulation p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Balance</p>
            <p className="num mt-1 text-3xl font-bold tracking-tight">
              {isLoading ? "—" : hidden ? "••••••" : fmt(totalUsdt)}{" "}
              <span className="text-base font-semibold text-muted-foreground">USDT</span>
            </p>
          </div>
          <BalancePrivacyToggle
            hidden={hidden}
            onToggle={onTogglePrivacy}
            className="border-transparent"
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {ACTIONS.map(({ id, label, icon: Icon, className }) => (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-xl px-3 py-0 text-sm transition-transform ${className}`}
            >
              <Icon className="size-4" strokeWidth={2.6} />
              {label}
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search asset"
            aria-label="Search asset"
            className="h-11 w-full rounded-full border border-border bg-secondary/50 pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={() => setHideZero((v) => !v)}
          aria-pressed={hideZero}
          className="flex shrink-0 touch-manipulation items-center gap-2 text-xs text-zinc-400"
        >
          <span
            className={`relative h-5 w-9 rounded-full transition-colors ${
              hideZero ? "bg-primary" : "bg-zinc-800"
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-background transition-all ${
                hideZero ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
          Hide zero balances
        </button>
      </div>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Asset</span>
          <span className="w-24 text-right">Balance</span>
          <span className="w-24 text-right">Value (USDT)</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((h) => (
            <div key={h.currency} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <AssetIcon currency={h.currency} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{h.currency}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {assetName(h.currency)}
                  </p>
                </div>
              </div>
              <span className="num w-24 text-right text-sm">
                {hidden ? "••••" : qty(h.balance, h.currency)}
              </span>
              <span className="num w-24 text-right text-sm font-semibold">
                {hidden ? "••••" : fmt(h.valueUsdt)}
              </span>
            </div>
          ))}
          {!isLoading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No assets found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
