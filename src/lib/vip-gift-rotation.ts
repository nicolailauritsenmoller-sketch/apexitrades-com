export const GIFT_DAY_MS = 24 * 60 * 60 * 1000;
export const GIFT_ROTATION_START = Date.UTC(2026, 10, 6);

export const VIP_GIFT_CATALOG = [
  { id: "apparel", category: "Apparel & Luggage", title: "Travel Collection", items: ["Durable hardshell carry-on", "Custom jacket", "Quilted vest", "Structured backpack"] },
  { id: "desk", category: "Desk Ecosystem Accessories", title: "Desk Collection", items: ["Heavyweight aluminum water bottle", "Matte-black coffee tumbler", "Wireless desktop charging pad", "Custom V-emblem mechanical keycaps"] },
  { id: "security", category: "Hardware & Security", title: "Security Collection", items: ["Ledger engraving concept", "Trezor engraving concept", "Protective hardware wallet pouch"] },
  { id: "special", category: "Special Drops", title: "Celebration Collection", items: ["End-of-Year Swag Box", "Birthday Treats"] },
] as const;

/** Presentation-only UTC schedule, independent of reloads and account status. */
export function giftRotationAt(now: number) {
  const day = Math.floor((now - GIFT_ROTATION_START) / GIFT_DAY_MS);
  const index = ((day % VIP_GIFT_CATALOG.length) + VIP_GIFT_CATALOG.length) % VIP_GIFT_CATALOG.length;
  const nextAt = GIFT_ROTATION_START + (day + 1) * GIFT_DAY_MS;
  return { pack: VIP_GIFT_CATALOG[index], index, nextAt, remainingSeconds: Math.ceil((nextAt - now) / 1000) };
}

export function giftCountdown(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map(value => String(value).padStart(2, "0")).join(":");
}