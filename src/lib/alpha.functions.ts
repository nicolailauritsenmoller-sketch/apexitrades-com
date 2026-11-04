import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getAlpha = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchAlpha } = await import("./alpha.server");
  return fetchAlpha();
});
export const getAlphaChart = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ tokenId: z.string().min(1).max(64), interval: z.enum(["15m", "1h"]) }).parse(input))
  .handler(async ({ data }) => {
    const { fetchAlphaChart } = await import("./alpha.server");
    return fetchAlphaChart(data.tokenId, data.interval);
  });