import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePreference } from "@/lib/preferences";
import { getDisplayRates } from "@/lib/rates.functions";

/** Currencies offered in the display-currency picker. */
export const DISPLAY_CURRENCIES = [
  { code: "USDT", name: "Tether", kind: "crypto" as const },
  { code: "USD", name: "US Dollar", kind: "fiat" as const },
  { code: "EUR", name: "Euro", kind: "fiat" as const },
  { code: "GBP", name: "British Pound", kind: "fiat" as const },
  { code: "BTC", name: "Bitcoin", kind: "crypto" as const },
];

export const DEFAULT_DISPLAY_CURRENCY = "USDT";

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

function decimalsFor(code: string) {
  return code === "BTC" ? 6 : 2;
}

/** Formats an amount already expressed in `code`. */
export function formatDisplayAmount(amount: number, code: string, opts?: { decimals?: number }) {
  const digits = opts?.decimals ?? decimalsFor(code);
  const text = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const sign = amount < 0 ? "-" : "";
  const symbol = SYMBOL[code];
  return symbol ? `${sign}${symbol}${text}` : `${sign}${text} ${code}`;
}

/**
 * Display-currency engine: reads the saved preference (localStorage + account
 * profile) and converts USDT-denominated values with live market rates.
 */
export function useDisplayCurrency() {
  const [currency, setCurrency] = usePreference("displayCurrency", DEFAULT_DISPLAY_CURRENCY);
  const fetchRates = useServerFn(getDisplayRates);

  const rates = useQuery({
    queryKey: ["display-rates"],
    queryFn: () => fetchRates(),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const rate = useMemo(() => {
    const map = (rates.data ?? {}) as Record<string, number>;
    const r = map[currency];
    return r && r > 0 ? r : currency === "USD" || currency === "USDT" ? 1 : 0;
  }, [rates.data, currency]);

  /** USDT amount -> amount in the selected display currency. */
  const convert = useCallback((usdt: number) => (rate > 0 ? usdt / rate : usdt), [rate]);

  /** USDT amount -> formatted string in the selected display currency. */
  const format = useCallback(
    (usdt: number, opts?: { decimals?: number }) =>
      formatDisplayAmount(convert(usdt), currency, opts),
    [convert, currency],
  );

  /** Signed formatting, e.g. "+$12.00" / "-€3.40". */
  const formatSigned = useCallback(
    (usdt: number, opts?: { decimals?: number }) => {
      const value = convert(usdt);
      return `${value >= 0 ? "+" : "-"}${formatDisplayAmount(Math.abs(value), currency, opts)}`;
    },
    [convert, currency],
  );

  return {
    currency,
    setCurrency,
    rate,
    ready: rates.isSuccess || currency === "USDT" || currency === "USD",
    convert,
    format,
    formatSigned,
    decimals: decimalsFor(currency),
  };
}
