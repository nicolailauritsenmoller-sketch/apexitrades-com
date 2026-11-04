import { describe, expect, it } from "vitest";
import { depositOptions, QUICK_DEPOSIT_ASSETS } from "./quick-deposit";

describe("Add Funds assets", () => {
  it("replaces wire with USDC alongside the three existing crypto assets", () => {
    expect([...QUICK_DEPOSIT_ASSETS]).toEqual(["USDT", "BTC", "ETH", "USDC"]);
  });

  it("offers only configured USDC addresses for the selected asset", () => {
    const addresses = [
      { coin: "USDC", network: "Ethereum ERC-20", address: "0xethereum" },
      { coin: "USDC", network: "Solana", address: "solana-address" },
      { coin: "USDC", network: "Base", address: "0xbase" },
      { coin: "USDT", network: "Ethereum ERC-20", address: "0xtether" },
      { coin: "USDC", network: "Unconfigured", address: " " },
    ];
    expect(depositOptions(addresses, "USDC").map((row) => row.network)).toEqual(["Ethereum ERC-20", "Solana", "Base"]);
  });
});