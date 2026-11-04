import { expect, it } from "vitest";
import { ADDRESS_ASSETS, validateAddress } from "./address-validation";
it("allows Ethereum, Solana and Base as USDC receiving networks", () => {
  expect(ADDRESS_ASSETS.USDC).toEqual(expect.arrayContaining(["ERC20", "SOL", "Base"]));
});
it("requires an EVM address for Base deposits", () => {
  expect(validateAddress("Base", "0x1234567890123456789012345678901234567890")).toBeNull();
  expect(validateAddress("Base", "this-is-not-a-base-wallet-address")).toBe("Invalid Base address format.");
});