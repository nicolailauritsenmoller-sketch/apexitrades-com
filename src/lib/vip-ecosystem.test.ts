import { expect, it } from "vitest";
import { DEFAULT_VIP_ECOSYSTEM, activeVipGift, ecosystemSchema, clearedTierQualified } from "./vip-ecosystem";
it("rotates configured collections exactly every 24 hours", () => {
  const start = Date.parse(DEFAULT_VIP_ECOSYSTEM.rotationStart);
  expect(activeVipGift(DEFAULT_VIP_ECOSYSTEM,start)?.id).toBe("apparel");
  expect(activeVipGift(DEFAULT_VIP_ECOSYSTEM,start+86_399_999)?.id).toBe("apparel");
  expect(activeVipGift(DEFAULT_VIP_ECOSYSTEM,start+86_400_000)?.id).toBe("desk");
});
it("manual overrides take precedence and disabled items never rotate", () => {
  expect(activeVipGift({ ...DEFAULT_VIP_ECOSYSTEM, activeGift: "security" },0)?.id).toBe("security");
  expect(activeVipGift({ ...DEFAULT_VIP_ECOSYSTEM, gifts: DEFAULT_VIP_ECOSYSTEM.gifts.map(g => ({ ...g, enabled: false })) },0)).toBeNull();
});
it("requires cleared AUM and collateral plus configured ETH holdings", () => {
  const tier = { min_portfolio_usdt: 10_000, min_collateral_usdt: 12_000, min_eth_holdings: 2 };
  expect(clearedTierQualified(tier,12_000,2)).toBe(true);
  expect(clearedTierQualified(tier,11_999,2)).toBe(false);
  expect(clearedTierQualified(tier,12_000,1.99)).toBe(false);
});
it("starts with the requested 5,000,000 USDT metric and preserves manual review", () => {
  expect(DEFAULT_VIP_ECOSYSTEM.withdrawalLimit).toBe(5_000_000);
  expect(DEFAULT_VIP_ECOSYSTEM.autoPromote).toBe(false);
  expect(ecosystemSchema.safeParse({ ...DEFAULT_VIP_ECOSYSTEM, withdrawalLimit: -1 }).success).toBe(false);
});