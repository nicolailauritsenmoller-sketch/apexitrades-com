import { describe, expect, it } from "vitest";
import { EQUITY_LOGOS, TOKEN_LOGOS } from "./asset-logo-registry";
import { FUTURE_LOGOS } from "./futures-logo-registry";
import { INSTRUMENTS } from "./instruments";

describe("published asset identity coverage", () => {
  it("covers every catalog crypto not already supplied by the original bundled marks", () => {
    const bundled = new Set(["BTC", "ETH", "SOL", "XRP", "BNB", "DOGE", "ADA", "AVAX", "LINK", "ATOM", "POL", "USDT", "TON", "SUI", "NEAR", "APT", "SHIB", "PEPE"]);
    for (const asset of INSTRUMENTS.filter(asset => asset.assetClass === "crypto")) {
      const base = asset.symbol.replace(/USDT?$/, "");
      if (!bundled.has(base)) expect(TOKEN_LOGOS[base], base).toMatch(/^\/__l5e\/assets-v1\//);
    }
    expect(TOKEN_LOGOS.USDC).toMatch(/^\/__l5e\/assets-v1\//);
  });

  it("covers all catalog companies and funds with permanent logo assets", () => {
    for (const asset of INSTRUMENTS.filter(asset => ["stock", "etf", "reit", "fund"].includes(asset.assetClass))) {
      expect(EQUITY_LOGOS[asset.symbol], asset.symbol).toMatch(/^\/__l5e\/assets-v1\//);
    }
    expect(EQUITY_LOGOS.AAPL).not.toBe(EQUITY_LOGOS.MSFT);
  });

  it("covers catalog futures with official exchange or index marks", () => {
    const branded = ["future", "energy", "rate"];
    for (const asset of INSTRUMENTS.filter(asset => branded.includes(asset.assetClass))) {
      if (asset.symbol === "BTC=F") continue; // CME Bitcoin keeps the Bitcoin mark
      expect(FUTURE_LOGOS[asset.symbol], asset.symbol).toMatch(/^\/__l5e\/assets-v1\//);
    }
    expect(FUTURE_LOGOS["ES=F"]).toBe(FUTURE_LOGOS["MES=F"]);
    expect(FUTURE_LOGOS["BZ=F"]).not.toBe(FUTURE_LOGOS["CL=F"]);
  });
});