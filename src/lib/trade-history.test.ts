import { describe, expect, it } from "vitest";
import { buildHistory, sortHistory, summarizeHistory } from "./trade-history";
import type { PositionRow } from "@/components/PositionsTable";
import type { ContractRow } from "./contracts.functions";

const position: PositionRow = {
  id: "12345678-1234-1234-1234-123456789012", symbol: "BTCUSDT", displaySymbol: "BTC / USDT",
  side: "long", quantity: 2, entryPrice: 100, exitPrice: 110, leverage: 5,
  currency: "USDT", status: "closed", realizedPnl: 18, feesPaid: 3,
  openedAt: "2026-11-01T12:00:00Z", closedAt: "2026-11-01T12:01:00Z",
};
const contract: ContractRow = {
  id: "87654321-1234-1234-1234-123456789012", symbol: "ETHUSDT", displaySymbol: "ETH / USDT",
  direction: "up", stake: 100, currency: "USDT", durationSeconds: 60, payoutPct: 20,
  leverage: 5, entryPrice: 100, exitPrice: 110, status: "settled", result: "win", payout: 120, feePaid: 1,
  openedAt: "2026-11-01T13:00:00Z", expiresAt: "2026-11-01T13:01:00Z", settledAt: "2026-11-01T13:01:01Z",
};

describe("institutional trade blotter", () => {
  it("shows entry notional instead of leveraged margin and deducts opening/closing fees once", () => {
    const [row] = buildHistory([position], []);
    expect(row.notional).toBe(200);
    expect(row.pnl).toBe(17);
    expect(row.pnlPct).toBe(42.5);
    expect(row.fees).toBe(3);
  });
  it("preserves scalp leverage, labels stake separately and deducts the recorded entry fee", () => {
    const [row] = buildHistory([], [contract]);
    expect(row.leverage).toBe(5);
    expect(row.notional).toBeNull();
    expect(row.stake).toBe(100);
    expect(row.settledAmount).toBe(120);
    expect(row.pnl).toBe(19);
    expect(row.pnlPct).toBe(19);
  });
  it("never turns missing realized PnL, payout or fee records into zero or a loss", () => {
    expect(buildHistory([{ ...position, realizedPnl: null }], [])[0].pnl).toBeNull();
    expect(buildHistory([{ ...position, feesPaid: null }], [])[0].pnl).toBeNull();
    expect(buildHistory([], [{ ...contract, payout: null }])[0].pnl).toBeNull();
    expect(buildHistory([], [{ ...contract, feePaid: null }])[0].pnl).toBeNull();
  });
  it("counts only completed records and calculates win rate and net aggregate from those rows", () => {
    const rows = buildHistory([position, { ...position, id: "open", status: "open" }], [contract, { ...contract, id: "loss", payout: 0 }]);
    const summary = summarizeHistory(rows);
    expect(summary.completed).toBe(3);
    expect(summary.winRate).toBeCloseTo(66.6666667);
    expect(summary.totals).toEqual([["USDT", -65]]);
  });
  it("keeps settlement currencies separate rather than fabricating a USDT conversion", () => {
    const summary = summarizeHistory(buildHistory([position, { ...position, id: "usd", currency: "USD" }], []));
    expect(summary.totals).toEqual([["USD", 17], ["USDT", 17]]);
  });
  it("sorts by recorded completion date and by net PnL without mutating input", () => {
    const rows = buildHistory([position], [contract]);
    expect(sortHistory(rows, "oldest")[0].id).toBe(position.id);
    expect(sortHistory(rows, "newest")[0].id).toBe(contract.id);
    expect(sortHistory(rows, "pnl-low")[0].pnl).toBe(17);
    expect(sortHistory(rows, "pnl-high")[0].pnl).toBe(19);
    expect(rows[0].id).toBe(contract.id);
  });
  it("excludes incomplete settlement timestamps and exits", () => {
    expect(buildHistory([{ ...position, closedAt: null }, { ...position, exitPrice: null }], [{ ...contract, settledAt: null }])).toEqual([]);
  });
});
