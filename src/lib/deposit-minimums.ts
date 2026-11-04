export type MinimumRule = { user_id: string | null; coin: string; min_amount: number | string };
export type ResolvedMinimum = { amount: number; source: "user" | "global" } | null;

/** Per-user override first, then the global default for the coin. */
export function resolveMinimum(rules: MinimumRule[], userId: string, coin: string): ResolvedMinimum {
  const c = coin.toUpperCase();
  const own = rules.find((r) => r.user_id === userId && r.coin.toUpperCase() === c);
  if (own) return { amount: Number(own.min_amount), source: "user" };
  const global = rules.find((r) => r.user_id === null && r.coin.toUpperCase() === c);
  if (global) return { amount: Number(global.min_amount), source: "global" };
  return null;
}
