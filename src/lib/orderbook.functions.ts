import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const depthInput = z.object({ symbol: z.string().max(20) });

export const getDepth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => depthInput.parse(input))
  .handler(async ({ data }) => {
    const { fetchDepth } = await import("./orderbook.server");
    try {
      return await fetchDepth(data.symbol);
    } catch {
      return { symbol: data.symbol, bids: [], asks: [], synthetic: true };
    }
  });
