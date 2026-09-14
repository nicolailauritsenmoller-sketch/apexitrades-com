import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps balances, transaction history and trade activity in sync with the
 * backend in real time. Refunds from declined/rejected withdrawals — and admin
 * activity resets — land instantly, without a refresh.
 */
export function useWalletRealtime(channelName = "wallet-live") {
  const qc = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      for (const key of [
        "wallet-activity",
        "portfolio-value",
        "portfolio",
        "daily-pnl",
        "contracts",
        "positions",
        "my-tickets",
        "support-threads",
        "support-tickets",
      ]) {
        qc.invalidateQueries({ queryKey: [key] });
      }
    };

    const channel = supabase.channel(channelName);
    for (const table of [
      "withdrawals",
      "deposits",
      "wallets",
      "swaps",
      "contracts",
      "positions",
      "support_tickets",
      "chat_sessions",
    ]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, channelName]);
}
