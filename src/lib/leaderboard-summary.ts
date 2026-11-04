export type DeskSummary = { volume_30d: number; pnl_30d: number; sharpe: number | null };
export function summarizeDesks(rows: DeskSummary[]) {
  const sharpe = rows.map(row => row.sharpe).filter((value): value is number => value !== null && Number.isFinite(value));
  return {
    volume: rows.reduce((sum, row) => sum + row.volume_30d, 0),
    sharpe: sharpe.length ? sharpe.reduce((sum, value) => sum + value, 0) / sharpe.length : null,
    topPnl: rows.length ? Math.max(...rows.map(row => row.pnl_30d)) : null,
  };
}