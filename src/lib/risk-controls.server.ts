/** Server-only reader for the global risk controls (platform_settings key "risk_controls"). */
export type RiskControls = {
  tradingPaused: boolean;
  maxLeverage: number | null;
  largeWithdrawalReview: boolean;
  largeWithdrawalThresholdUsd: number;
};

export const DEFAULT_RISK_CONTROLS: RiskControls = {
  tradingPaused: false,
  maxLeverage: null,
  largeWithdrawalReview: false,
  largeWithdrawalThresholdUsd: 10_000,
};

export async function loadRiskControls(): Promise<RiskControls> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("value")
    .eq("key", "risk_controls")
    .maybeSingle();
  return { ...DEFAULT_RISK_CONTROLS, ...((data?.value as Partial<RiskControls>) ?? {}) };
}

/** Throws when global circuit breakers block a new trade at this leverage. */
export async function assertTradingAllowed(leverage: number, userId?: string) {
  const rc = await loadRiskControls();
  if (rc.tradingPaused) throw new Error("New trade execution is temporarily paused by Risk Management.");
  let cap = rc.maxLeverage;
  if (userId) {
    const { loadVipPerk } = await import("./vip-fees.server");
    const perk = await loadVipPerk(userId);
    if (perk?.maxLeverage) cap = Number(perk.maxLeverage);
  }
  if (cap && leverage > cap) {
    throw new Error(`Maximum allowed leverage is currently ${cap}x.`);
  }
}
