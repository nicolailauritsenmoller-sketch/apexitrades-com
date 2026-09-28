import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Live typing indicator shared by the customer chat and the admin desk.
 * Uses an ephemeral broadcast channel per session - nothing is stored.
 */
export function useChatTyping(sessionId: string | null | undefined, role: "user" | "agent") {
  const [peerTyping, setPeerTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!sessionId) return;
    let clear: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`typing-${sessionId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload?.role === role) return;
        setPeerTyping(true);
        if (clear) clearTimeout(clear);
        clear = setTimeout(() => setPeerTyping(false), 3000);
      })
      .on("broadcast", { event: "stop" }, ({ payload }) => {
        if (payload?.role === role) return;
        setPeerTyping(false);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (clear) clearTimeout(clear);
      channelRef.current = null;
      setPeerTyping(false);
      supabase.removeChannel(channel);
    };
  }, [sessionId, role]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSent.current < 1500) return;
    lastSent.current = now;
    void channelRef.current?.send({ type: "broadcast", event: "typing", payload: { role } });
  }, [role]);

  const notifyStop = useCallback(() => {
    lastSent.current = 0;
    void channelRef.current?.send({ type: "broadcast", event: "stop", payload: { role } });
  }, [role]);

  return { peerTyping, notifyTyping, notifyStop };
}
