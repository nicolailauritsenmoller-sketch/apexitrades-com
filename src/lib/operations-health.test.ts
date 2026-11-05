import { describe, expect, it } from "vitest";
import { feedState, isHighValue, queueAge } from "./operations-health";
import { validateAssetAddress } from "./address-validation";
describe("Operations monitoring rules", () => {
  it("marks checks older than two minutes stale rather than live", () => {
    expect(feedState({ checked_at: new Date(0).toISOString(), status: "healthy" }, 120001)).toBe("stale");
    expect(feedState(undefined)).toBe("unchecked");
  });
  it("does not mark failed checks healthy", () => {
    expect(feedState({ checked_at: new Date(0).toISOString(), status: "unavailable" }, 60000)).toBe("unavailable");
  });
  it("requires distinct approval only above enabled stablecoin review threshold", () => {
    expect(isHighValue("USDC", 10001, { largeWithdrawalReview: true, largeWithdrawalThresholdUsd: 10000 })).toBe(true);
    expect(isHighValue("USDC", 10000, { largeWithdrawalReview: true, largeWithdrawalThresholdUsd: 10000 })).toBe(false);
    expect(isHighValue("BTC", 10001, { largeWithdrawalReview: true })).toBe(false);
    expect(isHighValue("USDT", 10001, { largeWithdrawalReview: false })).toBe(false);
  });
  it("tracks oldest waiting time from the actual queue timestamp", () => {
    expect(queueAge(new Date(0).toISOString(), 90 * 60000)).toBe("1h 30m waiting");
  });
  it("rejects asset/network mismatch even if the address format is valid", () => {
    expect(validateAssetAddress("BTC", "ERC20", "0x1234567890123456789012345678901234567890")).toBe("Unsupported asset/network combination.");
  });
  it("rejects EVM addresses configured on TRON", () => {
    expect(validateAssetAddress("USDT", "TRC20", "0x1234567890123456789012345678901234567890")).toBe("Invalid TRC20 address format.");
  });
});