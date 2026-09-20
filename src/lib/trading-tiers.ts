/**
 * Configurable trading-tier ladder. Thresholds are monthly eligible trading
 * volume in USDT and may be overridden by the `trading_tiers` platform setting.
 */

export type TradingTier = {
  key: string;
  label: string;
  /** Minimum monthly volume (USDT) required to hold this tier. */
  thresholdUsdt: number;
};

export const DEFAULT_TRADING_TIERS: TradingTier[] = [
  { key: "tier1", label: "Tier 1", thresholdUsdt: 0 },
  { key: "tier2", label: "Tier 2", thresholdUsdt: 50_000 },
  { key: "tier3", label: "Tier 3", thresholdUsdt: 250_000 },
  { key: "institutional", label: "Institutional", thresholdUsdt: 1_000_000 },
];

export function parseTradingTiers(value: unknown): TradingTier[] {
  if (!Array.isArray(value)) return DEFAULT_TRADING_TIERS;
  const parsed = value
    .map((row) => {
      const r = row as Record<string, unknown>;
      const key = typeof r["key"] === "string" ? r["key"] : null;
      const label = typeof r["label"] === "string" ? r["label"] : null;
      const threshold = Number(r["thresholdUsdt"]);
      if (!key || !label || !Number.isFinite(threshold)) return null;
      return { key, label, thresholdUsdt: Math.max(threshold, 0) };
    })
    .filter((row): row is TradingTier => row !== null)
    .sort((a, b) => a.thresholdUsdt - b.thresholdUsdt);
  return parsed.length > 0 ? parsed : DEFAULT_TRADING_TIERS;
}

/** Resolve the tier held at a given monthly volume, plus the next step up. */
export function resolveTier(volumeUsdt: number, tiers: TradingTier[] = DEFAULT_TRADING_TIERS) {
  const ladder = [...tiers].sort((a, b) => a.thresholdUsdt - b.thresholdUsdt);
  let current = ladder[0]!;
  for (const tier of ladder) if (volumeUsdt >= tier.thresholdUsdt) current = tier;
  const next = ladder.find((tier) => tier.thresholdUsdt > current.thresholdUsdt) ?? null;
  const span = next ? next.thresholdUsdt - current.thresholdUsdt : 0;
  const progressPct = next
    ? Math.min(100, Math.max(0, ((volumeUsdt - current.thresholdUsdt) / (span || 1)) * 100))
    : 100;
  return { current, next, progressPct };
}
