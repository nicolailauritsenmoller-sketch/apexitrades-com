import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { closePosition } from "@/lib/trading.functions";
import { formatMoney, formatPrice } from "@/lib/instruments";
import { AssetIcon } from "@/lib/asset-icons";
import type { Quote } from "@/lib/market-types";
import { TradeCloseSummary } from "@/components/TradeCloseSummary";
import { buildPositionSummary, type TradeSummary } from "@/lib/trade-summary";

export type PositionRow = {
  id: string;
  symbol: string;
  displaySymbol: string;
  side: string;
  quantity: number;
  entryPrice: number;
  exitPrice: number | null;
  leverage: number;
  currency: string;
  status: string;
  realizedPnl: number | null;
  openedAt: string;
  closedAt: string | null;
};

export function unrealizedPnl(p: PositionRow, price?: number) {
  if (!price) return null;
  const dir = p.side === "long" ? 1 : -1;
  return (price - p.entryPrice) * p.quantity * dir;
}

export function PositionsTable({
  positions,
  quotes,
  emptyLabel,
}: {
  positions: PositionRow[];
  quotes: Record<string, Quote>;
  emptyLabel: string;
}) {
  const queryClient = useQueryClient();
  const close = useServerFn(closePosition);
  const [summary, setSummary] = useState<TradeSummary | null>(null);

  const mutation = useMutation({
    mutationFn: async (id: string) => ({ id, res: await close({ data: { id } }) }),
    onSuccess: ({ id, res }) => {
      const p = positions.find((row) => row.id === id);
      if (p) {
        setSummary(
          buildPositionSummary({
            id: p.id,
            symbol: p.symbol,
            displaySymbol: p.displaySymbol,
            side: p.side,
            quantity: p.quantity,
            entryPrice: p.entryPrice,
            exitPrice: res.exitPrice,
            leverage: p.leverage,
            currency: res.currency,
            pnl: res.pnl,
            openedAt: p.openedAt,
            closedAt: new Date().toISOString(),
          }),
        );
      }
      toast[res.pnl >= 0 ? "success" : "error"](
        `Closed at ${formatPrice(res.exitPrice)} · ${res.pnl >= 0 ? "+" : ""}${formatMoney(res.pnl, res.currency)}`,
      );
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (positions.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      {summary && <TradeCloseSummary summary={summary} onClose={() => setSummary(null)} />}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[11px] uppercase tracking-wider text-muted-foreground">
            <th className="px-4 py-2.5 text-left font-medium">Instrument</th>
            <th className="px-4 py-2.5 text-left font-medium">Side</th>
            <th className="px-4 py-2.5 text-right font-medium">Size</th>
            <th className="px-4 py-2.5 text-right font-medium">Entry</th>
            <th className="px-4 py-2.5 text-right font-medium">
              {positions[0].status === "open" ? "Mark" : "Exit"}
            </th>
            <th className="px-4 py-2.5 text-right font-medium">P&L</th>
            <th className="px-4 py-2.5 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const mark = quotes[p.symbol]?.price;
            const pnl =
              p.status === "open" ? unrealizedPnl(p, mark) : (p.realizedPnl ?? 0);
            const positive = (pnl ?? 0) >= 0;
            return (
              <tr key={p.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <AssetIcon symbol={p.symbol} size={24} />
                    <div className="min-w-0">
                      <Link
                        to="/terminal/$symbol"
                        params={{ symbol: p.symbol }}
                        className="font-medium hover:text-primary"
                      >
                        {p.displaySymbol}
                      </Link>
                      <div className="num text-[11px] text-muted-foreground">
                        {p.leverage}x · {p.currency}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${
                      p.side === "long"
                        ? "bg-bull/15 text-bull"
                        : "bg-bear/15 text-bear"
                    }`}
                  >
                    {p.side}
                  </span>
                </td>
                <td className="num px-4 py-3 text-right">{p.quantity}</td>
                <td className="num px-4 py-3 text-right">
                  {formatPrice(p.entryPrice, p.symbol)}
                </td>
                <td className="num px-4 py-3 text-right">
                  {p.status === "open"
                    ? mark
                      ? formatPrice(mark, p.symbol)
                      : "—"
                    : formatPrice(p.exitPrice ?? 0, p.symbol)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  <LivePnl value={pnl} currency={p.currency} live={p.status === "open"} />
                </td>

                <td className="px-4 py-3 text-right">
                  {p.status === "open" && (
                    <button
                      onClick={() => mutation.mutate(p.id)}
                      disabled={mutation.isPending}
                      className="rounded border border-border px-2.5 py-1 text-xs transition-colors hover:bg-secondary disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
