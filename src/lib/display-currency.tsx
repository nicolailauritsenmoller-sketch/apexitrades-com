import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usePreference } from "@/lib/preferences";
import { getDisplayRates } from "@/lib/rates.functions";
import { convertDisplayAmount, decimalsFor, formatDisplayAmount } from "./display-currency-values";
export { DISPLAY_CURRENCIES, formatDisplayAmount } from "./display-currency-values";

export const DEFAULT_DISPLAY_CURRENCY = "USDT";

/**
 * Display-currency engine: reads the saved preference (localStorage + account
 * profile) and converts USDT-denominated values with live market rates.
 */
export function useDisplayCurrency(displayOverride?: string) {
  const [savedCurrency, setCurrency] = usePreference("displayCurrency", DEFAULT_DISPLAY_CURRENCY);
  const currency = displayOverride ?? savedCurrency;
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
  const convert = useCallback((usdt: number) => convertDisplayAmount(usdt, rate), [rate]);

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
      if (!Number.isFinite(value)) return "-";
      return `${value >= 0 ? "+" : "-"}${formatDisplayAmount(Math.abs(value), currency, opts)}`;
    },
    [convert, currency],
  );

  return {
    currency,
    setCurrency,
    rate,
    ready: rate > 0,
    convert,
    format,
    formatSigned,
    decimals: decimalsFor(currency),
  };
}
