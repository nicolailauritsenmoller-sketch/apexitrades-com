import { useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Repeat, Search } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { assetName } from "@/lib/transactions";
import { BalancePrivacyToggle } from "@/lib/balance-privacy";
import type { AssetHolding } from "@/components/AssetsOverview";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { assetInventory, filterInventory } from "./asset-inventory";

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
      "bg-primary text-primary-foreground font-semibold hover:bg-primary/90 active:scale-[0.97]",
  },
  {
    id: "withdraw",
    label: "Withdraw",
    icon: ArrowUpFromLine,
    className:
      "border border-bear/30 bg-bear/10 text-bear hover:bg-bear/20 active:scale-[0.97]",
  },
  {
    id: "swap",
    label: "Swap",
    icon: Repeat,
    className:
      "border border-border bg-secondary text-foreground hover:bg-secondary/80 active:scale-[0.97]",
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
  selectedAsset,
  onSelectAsset,
}: {
  holdings: AssetHolding[];
  totalUsdt: number;
  isLoading?: boolean;
  active: WalletAction;
  onSelect: (id: WalletAction) => void;
  hidden: boolean;
  onTogglePrivacy: () => void;
  selectedAsset: string;
  onSelectAsset: (currency: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(false);
  const [sample, setSample] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return filterInventory(assetInventory(holdings, sample), hideZero)
      .filter(
        (h) =>
          !term ||
          h.currency.toLowerCase().includes(term) ||
          assetName(h.currency).toLowerCase().includes(term),
      );
  }, [holdings, hideZero, search, sample]);

  return (
    <div className="space-y-4">
      <section className="panel touch-manipulation p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Total Balance</p>
            <p className="num mt-1 text-3xl font-bold tracking-tight">
              {isLoading ? "-" : hidden ? "••••••" : fmt(totalUsdt)}{" "}
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
            <Button variant="ghost"
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`flex min-h-12 touch-manipulation items-center justify-center gap-2 rounded-md px-3 py-0 text-sm transition-transform ${className}`}
            >
              <Icon className="size-4" strokeWidth={2.6} />
              {label}
            </Button>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
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
        <label className="flex min-h-11 shrink-0 items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={hideZero} onCheckedChange={setHideZero} aria-label="Hide zero balances" />
          Hide zero balances
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{sample ? "Illustrative balances - not available to withdraw or swap" : "Account balances"}</span>
        <label className="flex min-h-11 items-center gap-2">
          <Switch checked={sample} onCheckedChange={setSample} aria-label="Sample balances" />
          Sample balances
        </label>
      </div>

      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <span>Asset</span>
          <span className="w-20 text-right sm:w-24">Balance</span>
          <span className="w-20 text-right sm:w-24">Value (USDT)</span>
        </div>
        <div className="divide-y divide-border">
          {rows.map((h) => (
            <Button variant="ghost" type="button" key={h.currency} aria-label={`Select ${h.currency}`} aria-pressed={selectedAsset === h.currency} onClick={() => onSelectAsset(h.currency)} className={`grid h-auto w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-none px-4 py-3 text-left ${selectedAsset === h.currency ? "bg-secondary/60 ring-1 ring-inset ring-border" : ""}`}>
              <div className="flex min-w-0 items-center gap-3">
                <AssetIcon currency={h.currency} size={30} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{h.currency}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {assetName(h.currency)}
                  </p>
                </div>
              </div>
              <span className="num w-20 text-right text-xs sm:w-24 sm:text-sm">
                {hidden ? "••••" : qty(h.balance, h.currency)}
              </span>
              <span className="num w-20 text-right text-xs font-semibold sm:w-24 sm:text-sm">
                {hidden ? "••••" : fmt(h.valueUsdt)}
              </span>
            </Button>
          ))}
          {!isLoading && rows.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No assets found.</p>
          )}
        </div>
      </section>
    </div>
  );
}
