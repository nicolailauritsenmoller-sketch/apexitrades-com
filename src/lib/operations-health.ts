export const FEED_NAMES = { alpha: "Alpha intelligence", listings: "New listings", quotes: "Market quotes", chart: "BTC movement chart", news: "News publisher sample" } as const;
export function feedState(row: { checked_at: string; status: string } | undefined, now = Date.now()) {
  if (!row) return "unchecked";
  if (!Number.isFinite(Date.parse(row.checked_at)) || now - Date.parse(row.checked_at) > 120_000) return "stale";
  return row.status;
}
export function queueAge(value: string | null | undefined, now = Date.now()) {
  if (!value) return "No waiting items";
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  return minutes < 60 ? `${minutes}m waiting` : `${Math.floor(minutes / 60)}h ${minutes % 60}m waiting`;
}
export function isHighValue(currency: string, amount: number, controls: { largeWithdrawalReview?: boolean; largeWithdrawalThresholdUsd?: number }) {
  return controls.largeWithdrawalReview === true && ["USD", "USDT", "USDC", "BUSD", "DAI"].includes(currency.toUpperCase()) && Math.abs(amount) > (controls.largeWithdrawalThresholdUsd ?? 10_000);
}