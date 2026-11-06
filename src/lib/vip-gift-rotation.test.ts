import { describe, expect, it } from "vitest";
import { GIFT_DAY_MS, GIFT_ROTATION_START, giftRotationAt, giftCountdown } from "./vip-gift-rotation";

describe("daily VIP gift preview", () => {
  it("rotates at exactly 24 hours, not a second early", () => {
    expect(GIFT_DAY_MS).toBe(86_400_000);
    expect(giftRotationAt(GIFT_ROTATION_START).pack.id).toBe("apparel");
    expect(giftRotationAt(GIFT_ROTATION_START + 86_399_999).pack.id).toBe("apparel");
    expect(giftRotationAt(GIFT_ROTATION_START + 86_400_000).pack.id).toBe("desk");
  });
  it("cycles all four curated categories and wraps", () => {
    expect([0, 1, 2, 3, 4].map(day => giftRotationAt(GIFT_ROTATION_START + day * GIFT_DAY_MS).pack.id)).toEqual(["apparel", "desk", "security", "special", "apparel"]);
  });
  it("keeps the same daily selection after reload and advances across missed days", () => {
    const timestamp = GIFT_ROTATION_START + 2 * GIFT_DAY_MS + 1234;
    expect(giftRotationAt(timestamp).pack.id).toBe("security");
    expect(giftRotationAt(timestamp)).toEqual(giftRotationAt(timestamp));
    expect(giftRotationAt(timestamp + 7 * GIFT_DAY_MS).pack.id).toBe("desk");
  });
  it("counts down to the UTC boundary and resets to 24 hours", () => {
    expect(giftCountdown(giftRotationAt(GIFT_ROTATION_START + GIFT_DAY_MS - 1000).remainingSeconds)).toBe("00:00:01");
    expect(giftCountdown(giftRotationAt(GIFT_ROTATION_START + GIFT_DAY_MS).remainingSeconds)).toBe("24:00:00");
    expect(giftRotationAt(GIFT_ROTATION_START + 3600000).nextAt).toBe(Date.UTC(2026, 10, 7));
  });
});