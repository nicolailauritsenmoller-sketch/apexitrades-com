import type { PositionRow } from "@/components/PositionsTable";
import type { ContractRow } from "@/lib/contracts.functions";

export type HistoryEntry = {
  key: string;
  id: string;
  reference: string;
  kind: "position" | "contract";
  symbol: string;
  displaySymbol: string;
  isLong: boolean;
  leverage: number;
  entryPrice: number;
  exitPrice: number;
  notional: number | null;
  stake: number | null;
  settledAmount: number | null;
  currency: string;
  fees: number | null;
  pnl: number | null;
  pnlPct: number | null;
  openedAt: string;
  closedAt: string;
};

export type HistorySort = "newest" | "oldest" | "pnl-high" | "pnl-low";

/** Display calculations only; never changes settlements or wallet balances. */
export function buildHistory(positions: PositionRow[], contracts: ContractRow[]): HistoryEntry[] {
  const rows: HistoryEntry[] = [];
  for (const p of positions) {
    if (p.status !== "closed" || p.exitPrice == null || p.closedAt == null) continue;
    const notional = p.entryPrice * p.quantity;
    const fees = p.feesPaid ?? null;
    // Stored price movement less all recorded opening/closing fees.
    const pnl = p.realizedPnl == null || fees == null ? null
      : (p.exitPrice - p.entryPrice) * p.quantity * (p.side === "long" ? 1 : -1) - fees;
    const margin = notional / Math.max(p.leverage, 1);
    rows.push({
      key: `pos-${p.id}`, id: p.id, reference: `#ORD-P-${p.id.slice(0, 8).toUpperCase()}`,
      kind: "position", symbol: p.symbol, displaySymbol: p.displaySymbol,
      isLong: p.side === "long", leverage: p.leverage, entryPrice: p.entryPrice,
      exitPrice: p.exitPrice, notional, stake: null, settledAmount: null, currency: p.currency, fees, pnl,
      pnlPct: pnl != null && margin > 0 ? pnl / margin * 100 : null,
      openedAt: p.openedAt, closedAt: p.closedAt,
    });
  }
  for (const c of contracts) {
    if (c.status !== "settled" || c.exitPrice == null || c.settledAt == null) continue;
    const fees = c.feePaid ?? null;
    const pnl = c.payout == null || fees == null ? null : c.payout - c.stake - fees;
    rows.push({
      key: `ctr-${c.id}`, id: c.id, reference: `#ORD-C-${c.id.slice(0, 8).toUpperCase()}`,
      kind: "contract", symbol: c.symbol, displaySymbol: c.displaySymbol,
      isLong: c.direction === "up", leverage: c.leverage, entryPrice: c.entryPrice,
      exitPrice: c.exitPrice, notional: null, stake: c.stake, settledAmount: c.payout, currency: c.currency, fees, pnl,
      pnlPct: pnl != null && c.stake > 0 ? pnl / c.stake * 100 : null,
      openedAt: c.openedAt, closedAt: c.settledAt,
    });
  }
  return sortHistory(rows, "newest");
}

export function sortHistory(entries: HistoryEntry[], sort: HistorySort): HistoryEntry[] {
  return [...entries].sort((a, b) => {
    if (sort === "newest" || sort === "oldest") {
      const delta = Date.parse(b.closedAt) - Date.parse(a.closedAt);
      return (sort === "newest" ? delta : -delta) || a.key.localeCompare(b.key);
    }
    // Different settlement currencies must not be compared as if they were USDT.
    const currencyOrder = a.currency.localeCompare(b.currency);
    if (currencyOrder) return currencyOrder;
    if (a.pnl == null) return b.pnl == null ? a.key.localeCompare(b.key) : 1;
    if (b.pnl == null) return -1;
    return (sort === "pnl-high" ? b.pnl - a.pnl : a.pnl - b.pnl) || a.key.localeCompare(b.key);
  });
}

export function summarizeHistory(entries: HistoryEntry[]) {
  const known = entries.filter((e) => e.pnl != null);
  const totals = new Map<string, number>();
  for (const e of known) totals.set(e.currency, (totals.get(e.currency) ?? 0) + (e.pnl ?? 0));
  return {
    completed: entries.length,
    priced: known.length,
    winRate: known.length ? known.filter((e) => e.pnl != null && e.pnl > 0).length / known.length * 100 : null,
    totals: [...totals.entries()].sort(([a], [b]) => a.localeCompare(b)),
  };
}