import { Check, Coins } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AssetIcon } from "@/lib/asset-icons";
import { DISPLAY_CURRENCIES, useDisplayCurrency } from "@/lib/display-currency";
import { logActivity } from "@/lib/telemetry";

/** Currency picker modal for the global display-currency preference. */
export function DisplayCurrencyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
}) {
  const { currency, setCurrency, rate } = useDisplayCurrency();

  function choose(code: string) {
    setCurrency(code);
    void logActivity("settings", `Changed display currency to ${code}`, {
      setting: "displayCurrency",
      value: code,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Coins className="size-4 text-primary" /> Display currency
          </DialogTitle>
          <DialogDescription className="text-xs">
            Balances across your home screen and portfolio are converted at live market rates.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
          {DISPLAY_CURRENCIES.map((c) => {
            const active = c.code === currency;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => choose(c.code)}
                className={`flex w-full touch-manipulation items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-secondary"
                }`}
              >
                <AssetIcon currency={c.code} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{c.code}</span>
                  <span className="block text-[11px] text-muted-foreground">{c.name}</span>
                </span>
                {active && (
                  <span className="flex items-center gap-2">
                    {rate > 0 && (
                      <span className="num text-[11px] text-muted-foreground">
                        1 {c.code} ≈ {rate.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT
                      </span>
                    )}
                    <Check className="size-4 text-primary" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
