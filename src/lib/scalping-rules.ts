import { z } from "zod";

export const scalpingRuleInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(1).max(40),
  duration_seconds: z.number().int().min(1).max(31_536_000),
  min_trade_amount: z.number().positive().max(100_000_000),
  roi_pct: z.number().min(0).max(10_000),
  active: z.boolean(),
  reason: z.string().trim().max(400).optional(),
});

export type ScalpingRule = Omit<z.infer<typeof scalpingRuleInput>, "id" | "reason"> & {
  id: string; updated_at: string; deleted_at: string | null;
};

export function validateScalpingOrder(rule: ScalpingRule | null, order: {
  stake: number; durationSeconds: number; tierVersion: string;
}) {
  if (!rule || !rule.active || rule.deleted_at) throw new Error("This duration tier is no longer available.");
  if (rule.updated_at !== order.tierVersion || rule.duration_seconds !== order.durationSeconds)
    throw new Error("Trade configuration changed. Review the current terms and submit again.");
  if (order.stake < Number(rule.min_trade_amount))
    throw new Error(`Minimum investment for ${rule.label} is ${Number(rule.min_trade_amount).toLocaleString("en-US")} USDT.`);
  return rule;
}

export function scalpingProfit(stake: number, roiPct: number, leverage: number) {
  return (stake * roiPct * leverage) / 100;
}