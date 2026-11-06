export const DISPLAY_CURRENCIES = [
  { code: "USDT", name: "Tether", kind: "crypto" as const },
  { code: "USD", name: "US Dollar", kind: "fiat" as const },
  { code: "EUR", name: "Euro", kind: "fiat" as const },
  { code: "GBP", name: "British Pound", kind: "fiat" as const },
  { code: "CAD", name: "Canadian Dollar", kind: "fiat" as const },
  { code: "AED", name: "United Arab Emirates Dirham", kind: "fiat" as const },
  { code: "AUD", name: "Australian Dollar", kind: "fiat" as const },
  { code: "CHF", name: "Swiss Franc", kind: "fiat" as const },
  { code: "RUB", name: "Russian Ruble", kind: "fiat" as const },
  { code: "SGD", name: "Singapore Dollar", kind: "fiat" as const },
  { code: "TND", name: "Tunisian Dinar", kind: "fiat" as const },
  { code: "VES", name: "Venezuelan Bolívar", kind: "fiat" as const },
  { code: "JPY", name: "Japanese Yen", kind: "fiat" as const },
  { code: "BTC", name: "Bitcoin", kind: "crypto" as const },
];

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "$", AUD: "A$", SGD: "S$", RUB: "₽", VES: "Bs. ", JPY: "¥" };
export const decimalsFor = (code: string) => code === "BTC" ? 6 : code === "JPY" ? 0 : code === "TND" ? 3 : 2;

/** Rates are USDT per unit: divide, never multiply, to convert a USDT balance. */
export function convertDisplayAmount(usdt: number, rate: number) {
  return Number.isFinite(rate) && rate > 0 ? usdt / rate : Number.NaN;
}

export function formatDisplayAmount(amount: number, code: string, opts?: { decimals?: number }) {
  if (!Number.isFinite(amount)) return "-";
  const digits = opts?.decimals ?? decimalsFor(code);
  const text = Math.abs(amount).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = amount < 0 ? "-" : "";
  return SYMBOL[code] ? `${sign}${SYMBOL[code]}${text}` : `${sign}${text} ${code}`;
}

/** Daily FX fallback must be an actual recent provider quote, not a static rate. */
export function parseDisplayFx(data: { result?: string; base_code?: string; time_last_update_unix?: number; rates?: Record<string, number> }, now: number) {
  if (data.result !== "success" || data.base_code !== "USD" || !data.time_last_update_unix || Math.abs(now - data.time_last_update_unix * 1000) > 48 * 3600_000) return {};
  const rates: Record<string, number> = {};
  for (const { code, kind } of DISPLAY_CURRENCIES) {
    if (kind !== "fiat" || code === "USD") continue;
    const rate = data.rates?.[code];
    if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) rates[code] = 1 / rate;
  }
  return rates;
}