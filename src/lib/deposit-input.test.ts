import { describe, expect, it } from "vitest";
import { depositInput } from "./deposit-input";

const deposit = { coin: "USDT", network: "TRON", amount: 100 };

describe("deposit payment proof", () => {
  it("requires an attachment before submission", () => {
    for (const receiptPath of [undefined, "", "   "]) {
      expect(depositInput.safeParse({ ...deposit, receiptPath }).success).toBe(false);
    }
  });
  it("keeps transaction hashes optional when proof is attached", () => {
    expect(depositInput.parse({ ...deposit, receiptPath: "user/payment.png" }).txHash).toBeUndefined();
  });
});