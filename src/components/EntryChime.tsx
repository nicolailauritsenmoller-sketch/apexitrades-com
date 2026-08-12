import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playAurora, unlockAudio } from "@/lib/alerts";
import { registerCurrentDevice } from "@/lib/sessions";

const MUTE_KEY = "velocity:entry-sound";
const VISIT_KEY = "velocity:entry-played";

/**
 * Plays the soft "Aurora" chime the first time a visitor lands on the platform
 * (after their first interaction, per browser autoplay policy) and again on
 * every successful sign-in. Also records the login session for admin monitoring.
 */
export function EntryChime() {
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setMuted(localStorage.getItem(MUTE_KEY) === "off");
  }, []);

  // Entry chime — needs a user gesture before audio is allowed to play.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const fire = () => {
      unlockAudio();
      if (localStorage.getItem(MUTE_KEY) === "off") return;
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
      if (localStorage.getItem(MUTE_KEY) !== "off") playAurora();
      if (session?.user?.id) void registerCurrentDevice(session.user.id);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  function toggle() {
    const next = !muted;
    setMuted(next);
    localStorage.setItem(MUTE_KEY, next ? "off" : "on");
    if (!next) {
      unlockAudio();
      playAurora();
    }
  }

  return (
    <button
      onClick={toggle}
      title={muted ? "Enable app sounds" : "Mute app sounds"}
      aria-label={muted ? "Enable app sounds" : "Mute app sounds"}
      className="fixed bottom-3 left-3 z-40 grid size-9 touch-manipulation place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
    >
      {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
    </button>
  );
}
