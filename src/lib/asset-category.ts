import { INSTRUMENTS, type AssetClass } from "@/lib/instruments";

/** Allocation buckets: market asset classes plus wallet-held fiat cash. */
export type AllocationCategory = AssetClass | "fiat";

const FIAT = new Set([
  "USD", "EUR", "GBP", "JPY", "CHF", "AUD", "CAD", "NZD", "CNY", "HKD", "SGD",
  "SEK", "NOK", "DKK", "MXN", "ZAR", "TRY", "INR", "BRL", "KRW",
]);
const STABLES = new Set(["USDT", "USDC", "BUSD", "DAI", "FDUSD", "TUSD", "PYUSD", "USDE"]);
const METALS = new Set(["XAU", "XAG", "XPT", "XPD", "GOLD", "SILVER"]);
const SYMBOL_CLASS = new Map(INSTRUMENTS.map((i) => [i.symbol.toUpperCase(), i.assetClass]));
const FX_PAIR = /^([A-Z]{3})\/?([A-Z]{3})(=X)?$/;

/** Classify a held asset by its real type: stablecoins/coins are crypto, cash currencies are fiat, pairs are forex. */
export function categoryOf(currency: string): AllocationCategory {
  const c = currency.trim().toUpperCase();
  if (STABLES.has(c)) return "crypto";
  if (FIAT.has(c)) return "fiat";
  if (METALS.has(c) || c.startsWith("XAU") || c.startsWith("XAG")) return "metal";
  const direct = SYMBOL_CLASS.get(c);
  if (direct) return direct;
  const fx = FX_PAIR.exec(c);
  if (fx && FIAT.has(fx[1]) && FIAT.has(fx[2])) return "forex";
  return "crypto";
}
