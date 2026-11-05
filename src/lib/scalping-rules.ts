import { z } from "zod";
import { INSTRUMENT_MAP } from "./instruments";

export const SCALPING_MAJORS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"];
export const SCALPING_RULE_COLUMNS = "id,label,duration_seconds,min_trade_amount,max_trade_amount,allowed_pairs,commission_pct,daily_payout_cap,roi_pct,active,updated_at,deleted_at";

export const scalpingRuleInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  duration_seconds: z.number().int().min(1).max(31_536_000),
  min_trade_amount: z.number().positive().max(100_000_000),
  max_trade_amount: z.number().positive().max(100_000_000).nullable().default(null),
  allowed_pairs: z.array(z.string().refine(symbol => Boolean(INSTRUMENT_MAP[symbol]), "Unknown trading pair")).max(1000).default([]),
  commission_pct: z.number().min(0).max(100).default(0),
  daily_payout_cap: z.number().positive().max(1_000_000_000_000).nullable().default(null),
  roi_pct: z.number().min(0).max(10_000),
  active: z.boolean(),
  reason: z.string().trim().max(400).optional(),
}).refine(rule => rule.max_trade_amount === null || rule.max_trade_amount >= rule.min_trade_amount, {
  path: ["max_trade_amount"], message: "Maximum trade amount must be at least the minimum.",
});

export type ScalpingRule = Omit<z.infer<typeof scalpingRuleInput>, "id" | "reason"> & {
  id: string; updated_at: string; deleted_at: string | null;
};

export function validateScalpingOrder(rule: ScalpingRule | null, order: {
  stake: number; durationSeconds: number; tierVersion: string; symbol?: string;
}) {
  if (!rule || !rule.active || rule.deleted_at) throw new Error("This duration tier is no longer available.");
  if (rule.updated_at !== order.tierVersion || rule.duration_seconds !== order.durationSeconds)
    throw new Error("Trade configuration changed. Review the current terms and submit again.");
  if (order.stake < Number(rule.min_trade_amount))
    throw new Error(`Minimum investment for ${rule.label} is ${Number(rule.min_trade_amount).toLocaleString("en-US")} USDT.`);
  if (rule.max_trade_amount !== null && order.stake > Number(rule.max_trade_amount))
    throw new Error(`Maximum investment for ${rule.label} is ${Number(rule.max_trade_amount).toLocaleString("en-US")} USDT.`);
  if (!scalpingPairAllowed(rule, order.symbol ?? ""))
    throw new Error("This trading pair is not eligible for the selected tier.");
  return rule;
}

export function scalpingPairAllowed(rule: Pick<ScalpingRule, "allowed_pairs">, symbol: string) {
  return rule.allowed_pairs.length === 0 || rule.allowed_pairs.includes(symbol);
}

export function scalpingCommission(stake: number, pct: number) {
  return Math.round(stake * pct / 100 * 1e8) / 1e8;
}

export function scalpingProfit(stake: number, roiPct: number, leverage: number) {
  return (stake * roiPct * leverage) / 100;
}