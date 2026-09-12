import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trade")({
  validateSearch: (search: Record<string, unknown>): { symbol: string } => ({
    symbol: typeof search["symbol"] === "string" && search["symbol"] ? search["symbol"] : "BTCUSDT",
  }),
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/terminal/$symbol", params: { symbol: search.symbol }, replace: true });
  },
});
