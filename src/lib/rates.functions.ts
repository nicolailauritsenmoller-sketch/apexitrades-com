import { createServerFn } from "@tanstack/react-start";

/**
 * Live USDT value of one unit of each supported display currency.
 * Used by the client-side display-currency conversion engine.
 */
export const getDisplayRates = createServerFn({ method: "GET" }).handler(async () => {
  const { usdtRates } = await import("./rates.server");
  return await usdtRates();
});
