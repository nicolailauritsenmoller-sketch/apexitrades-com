import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Keeps balances and transaction history in sync with the backend in real time.
 * Refunds from declined/rejected withdrawals land instantly, without a refresh.
 */
export function useWalletRealtime(channelName = "wallet-live") {
  const qc = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["wallet-activity"] });
      qc.invalidateQueries({ queryKey: ["portfolio-value"] });
      qc.invalidateQueries({ queryKey: ["portfolio"] });
    };

    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "withdrawals" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "deposits" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, channelName]);
}
