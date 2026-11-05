import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getScalpingRules } from "@/lib/scalping-rules.functions";

export function useScalpingRules(admin = false) {
  const client = useQueryClient();
  const fetchRules = useServerFn(getScalpingRules);
  const query = useQuery({ queryKey: ["scalping-rules", admin], queryFn: () => fetchRules({ data: { admin } }), refetchInterval: 15_000, staleTime: 0 });
  useEffect(() => {
    // Safe INSERT/UPDATE payloads immediately replace or remove the active tier,
    // including when it becomes invisible to the trader SELECT policy.
    const channel = supabase.channel(`scalping-rules-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "scalping_tier_rules" }, () => {
        void client.invalidateQueries({ queryKey: ["scalping-rules"] });
      })
      .subscribe((status) => { if (status === "SUBSCRIBED") void client.invalidateQueries({ queryKey: ["scalping-rules"] }); });
    return () => { void supabase.removeChannel(channel); };
  }, [client]);
  return query;
}