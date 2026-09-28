import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { playAurora, unlockAudio } from "@/lib/alerts";
import { registerCurrentDevice } from "@/lib/sessions";

const VISIT_KEY = "velocity:entry-played";

/**
 * Plays the soft "Aurora" chime the first time a visitor lands on the platform
 * (after their first interaction, per browser autoplay policy) and again on
 * every successful sign-in. Also records the login session for admin monitoring.
 * Renders nothing.
 */
export function EntryChime() {
  // Entry chime - needs a user gesture before audio is allowed to play.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fire = () => {
      unlockAudio();
      if (sessionStorage.getItem(VISIT_KEY) === "1") return;
      sessionStorage.setItem(VISIT_KEY, "1");
      playAurora();
    };
    window.addEventListener("pointerdown", fire, { once: true });
    window.addEventListener("keydown", fire, { once: true });
    return () => {
      window.removeEventListener("pointerdown", fire);
      window.removeEventListener("keydown", fire);
    };
  }, []);

  // Login chime + session log.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN") return;
      playAurora();
      if (session?.user?.id) void registerCurrentDevice(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return null;
}
