/**
 * Instant Control Center synchronisation.
 *
 * A single realtime channel listens to every public-schema change and pushes
 * the matching console queries into an immediate refetch, so operator tables
 * update the moment a user submits — no polling window, no debounce. A 5s
 * heartbeat re-joins the channel if the socket ever goes idle or drops.
 */

import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Table → console query keys that must reflect the change instantly. */
const TABLE_KEYS: Record<string, string[]> = {
  chat_messages: ["support-threads", "support-thread", "desk-unread", "admin-overview"],
  chat_sessions: ["support-threads", "desk-unread"],
  chat_ratings: ["chat-ratings"],
  support_tickets: ["support-tickets", "desk-unread", "admin-overview"],
  support_ticket_messages: ["support-tickets", "desk-unread"],
  vip_messages: ["vip-desk", "vip-desk-thread", "desk-unread"],
  vip_access: ["vip-desk", "admin-vip-members"],
  deposits: ["admin-overview", "admin-analytics", "admin-user-workspace", "admin-users"],
  withdrawals: ["admin-overview", "admin-analytics", "admin-user-workspace", "admin-users"],
  swaps: ["admin-overview", "admin-analytics", "admin-user-workspace"],
  wallets: ["admin-user-wallets", "admin-wallets", "admin-user-workspace", "admin-users"],
  kyc_submissions: ["admin-overview", "admin-user-workspace", "admin-user-directory"],
  profiles: [
    "admin-overview",
    "admin-analytics",
    "admin-users",
    "admin-user-directory",
    "admin-vip-pending",
    "admin-vip-members",
    "admin-vip-declined",
  ],
  user_sessions: ["active-users", "admin-overview", "admin-analytics", "telemetry"],
  contracts: ["desk-trades", "admin-overview", "admin-analytics", "admin-risk-monitor"],
  positions: ["desk-trades", "admin-overview", "admin-analytics", "admin-risk-monitor"],
  security_reports: ["admin-user-security", "admin-overview"],
  referrals: ["admin-referrals"],
  admin_audit_logs: ["admin-audit-logs"],
  announcements: ["admin-announcements", "announcements-active"],
  community_channels: ["admin-community", "community-public-channels"],
  community_announcements: ["admin-community", "community-public-announcements"],
  community_vip_requests: ["admin-community"],
  user_roles: ["admin-user-directory", "admin-users"],
  notifications: ["notifications", "notifications-unread"],
};

/** Subscribes the Control Center to every live change with zero polling delay. */
export function useAdminLiveSync(queryClient: QueryClient) {
  useEffect(() => {
    const channel = supabase
      .channel(`ops-live-sync-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public" }, (payload) => {
        const keys = TABLE_KEYS[payload.table];
        if (!keys) return;
        for (const key of keys) {
          // Refetch active console views immediately; idle ones are marked stale.
          void queryClient.invalidateQueries({ queryKey: [key], refetchType: "active" });
        }
      })
      .subscribe();

    // Heartbeat: re-join a dropped or idle socket so alerts never go missing.
    const beat = setInterval(() => {
      const state = (channel as unknown as { state?: string }).state;
      if (state === "joined" || state === "joining") return;
      try {
        void channel.subscribe();
      } catch {
        /* channel torn down during unmount */
      }
    }, 5000);

    return () => {
      clearInterval(beat);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
