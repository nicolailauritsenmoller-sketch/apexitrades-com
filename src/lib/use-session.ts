import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * True once a Supabase access token exists in the browser. Server functions
 * guarded by `requireSupabaseAuth` throw "Unauthorized: No authorization header
 * provided" when called without one (signed out, expired, or pre-hydration), so
 * gate those queries on this flag instead of firing them eagerly.
 */
export function useHasSession() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session?.access_token));
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setHasSession(Boolean(session?.access_token));
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return hasSession;
}
