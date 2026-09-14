/** Client-safe VIP tier metadata shared by the profile, upgrade page and backend. */

export type VipTierKey = "regular" | "vip1";

export const VIP1_THRESHOLD_USDT = 20_000;

export const VIP_TIER_LABEL: Record<string, string> = {
  regular: "Regular",
  vip1: "VIP 1",
};

export const VIP1_PERKS = [
  "Zero trading fees on all markets",
  "Priority 24/7 dedicated account manager",
  "Elevated daily withdrawal limits",
  "Exclusive scalp contract return rates",
];

export function isVip(tier?: string | null) {
  return (tier ?? "regular") !== "regular";
}
