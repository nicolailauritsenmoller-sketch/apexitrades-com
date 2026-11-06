import { z } from "zod";
import { VIP_GIFT_CATALOG, GIFT_ROTATION_START, GIFT_DAY_MS } from "./vip-gift-rotation";

export const giftEntrySchema = z.object({ id: z.string().regex(/^[a-z0-9-]+$/).max(40), image: z.enum(["apparel", "desk", "security", "special"]), category: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(80), items: z.array(z.string().trim().min(1).max(120)).min(1).max(12), stock: z.number().int().min(0).max(1_000_000), enabled: z.boolean() });
export const ecosystemSchema = z.object({ withdrawalLimit: z.number().finite().min(0).max(1_000_000_000), showEth: z.boolean(), autoPromote: z.boolean(), rotateDaily: z.boolean(), rotationStart: z.string().datetime(), activeGift: z.string().max(40).nullable(), gifts: z.array(giftEntrySchema).min(1).max(40) }).refine(d => new Set(d.gifts.map(g => g.id)).size === d.gifts.length && (!d.activeGift || d.gifts.some(g => g.id === d.activeGift && g.enabled)), { message: "Gift IDs must be unique and an override must reference an enabled gift." });
export type VipEcosystem = z.infer<typeof ecosystemSchema>;
export const DEFAULT_VIP_ECOSYSTEM: VipEcosystem = { withdrawalLimit: 5_000_000, showEth: true, autoPromote: false, rotateDaily: true, rotationStart: new Date(GIFT_ROTATION_START).toISOString(), activeGift: null, gifts: VIP_GIFT_CATALOG.map(g => ({ ...g, items: [...g.items], image: g.id, stock: 0, enabled: true })) };
export function ecosystemConfig(value: unknown): VipEcosystem { const result = ecosystemSchema.safeParse(value); return result.success ? result.data : DEFAULT_VIP_ECOSYSTEM; }
export function activeVipGift(config: VipEcosystem, now: number) {
  const enabled = config.gifts.filter(g => g.enabled);
  const override = enabled.find(g => g.id === config.activeGift);
  if (override) return override;
  if (!enabled.length) return null;
  const day = config.rotateDaily ? Math.floor((now - Date.parse(config.rotationStart)) / GIFT_DAY_MS) : 0;
  return enabled[((day % enabled.length) + enabled.length) % enabled.length];
}
export function clearedTierQualified(tier: { min_portfolio_usdt: number | string; min_collateral_usdt?: number | string; min_eth_holdings?: number | string }, balance: number, eth: number) {
  const minimum = Math.max(Number(tier.min_portfolio_usdt), Number(tier.min_collateral_usdt ?? 0));
  const ethMinimum = Number(tier.min_eth_holdings ?? 0);
  return (minimum > 0 || ethMinimum > 0) && balance >= minimum && eth >= ethMinimum;
}