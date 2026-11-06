import { describe, expect, it } from "vitest";
import { VIP_PORTAL_WITHDRAWAL_LIMIT_USDT, vipEthBalance } from "./vip-portal-metrics";

describe("VIP Portal metrics", () => {
  it("sets the portal withdrawal metric to 5,000,000.00 USDT", () => {
    expect(VIP_PORTAL_WITHDRAWAL_LIMIT_USDT).toBe(5_000_000);
  });

  it("uses actual ETH holdings rather than BNB holdings", () => {
    expect(vipEthBalance([
      { currency: "ETH", balance: "1.25" },
      { currency: "eth", balance: 0.5 },
      { currency: "BNB", balance: "100" },
      { currency: "USDT", balance: "5000" },
    ])).toBe(1.75);
  });
});