import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trade")({
  beforeLoad: () => {
    throw redirect({ to: "/terminal/$symbol", params: { symbol: "BTCUSDT" }, replace: true });
  },
});
