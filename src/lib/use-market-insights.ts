import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MarketInsight = {
  id: string;
  title: string;
  source: string;
  category: string;
  content: string;
  active: boolean;
  created_at: string;
};

export const INSIGHT_CATEGORIES = [
  "crypto",
  "macro",
  "regulation",
  "equities",
  "forex",
  "commodities",
  "desk",
] as const;

/** Desk-published market intelligence with a realtime subscription. */
export function useMarketInsights(channelName: string, includeInactive = false) {
  const qc = useQueryClient();
  const key = ["market-insights", includeInactive];
  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      let q = supabase
        .from("market_insights")
        .select("id,title,source,category,content,active,created_at")
        .order("created_at", { ascending: false })
        .limit(includeInactive ? 50 : 10);
      if (!includeInactive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as MarketInsight[];
    },
    staleTime: 30_000,
  });
  useEffect(() => {
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "market_insights" }, () => {
        qc.invalidateQueries({ queryKey: ["market-insights"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [channelName, qc]);
  return query;
}
