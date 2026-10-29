import { describe, expect, it } from "vitest";
import { assetInventory, filterInventory } from "./asset-inventory";

describe("Assets inventory", () => {
  it("includes USDT and all five requested coins without creating funded balances", () => {
    const rows = assetInventory([]);
    expect(rows.map((row) => row.currency)).toEqual(["USDT", "BTC", "ETH", "SOL", "XRP", "BNB"]);
    expect(rows.every((row) => row.balance === 0 && row.valueUsdt === 0)).toBe(true);
  });
  it("preserves real balances separately from illustrative quantities", () => {
    const real = [{ currency: "BTC", balance: 0.01, rate: 70000, valueUsdt: 700 }];
    expect(assetInventory(real).find((row) => row.currency === "BTC")?.balance).toBe(0.01);
    expect(assetInventory(real, true).find((row) => row.currency === "BTC")?.balance).toBe(0.125);
    expect(real[0]?.balance).toBe(0.01);
  });
  it("hides zero balances dynamically including the zero BNB sample", () => {
    const rows = assetInventory([], true);
    expect(filterInventory(rows, true).map((row) => row.currency)).toEqual(["USDT", "BTC", "ETH", "SOL", "XRP"]);
    expect(filterInventory(rows, false)).toHaveLength(6);
  });
});