import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { closePosition } from "@/lib/trading.functions";
import { formatMoney, formatPrice } from "@/lib/instruments";
import type { Quote } from "@/lib/market-types";

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

  const mutation = useMutation({
    mutationFn: (id: string) => close({ data: { id } }),
    onSuccess: (res) => {
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
                <td
                  className={`num px-4 py-3 text-right font-medium ${
                    pnl == null ? "text-muted-foreground" : positive ? "text-bull" : "text-bear"
                  }`}
                >
                  {pnl == null
                    ? "—"
                    : `${positive ? "+" : ""}${formatMoney(pnl, p.currency)}`}
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
