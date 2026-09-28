/**
 * Control Center audio notification library.
 *
 * Each key system event maps to its own professional chime file under
 * /sounds/. Files are preloaded on first use so playback is instant, and
 * playback is gated behind a one-time user gesture (browser autoplay policy).
 */

export type DeskSound =
  | "deposit"
  | "vip-deposit"
  | "vip-request"
  | "withdrawal"
  | "trade"
  | "kyc"
  | "new-user"
  | "visitor";

export const DESK_SOUND_FILES: Record<DeskSound, string> = {
  deposit: "/sounds/deposit.mp3",
  "vip-deposit": "/sounds/vip-deposit.mp3",
  "vip-request": "/sounds/vip-request.mp3",
  withdrawal: "/sounds/withdrawal.mp3",
  trade: "/sounds/trade.mp3",
  kyc: "/sounds/kyc.mp3",
  "new-user": "/sounds/new-user.mp3",
  visitor: "/sounds/visitor.mp3",
};

/** Relative loudness per event so high-priority alerts cut through. */
const VOLUME: Record<DeskSound, number> = {
  deposit: 0.8,
  "vip-deposit": 1,
  "vip-request": 0.95,
  withdrawal: 0.8,
  trade: 0.55,
  kyc: 0.8,
  "new-user": 0.7,
  visitor: 0.35,
};

export const DESK_AUDIO_UNLOCK_KEY = "velocity:desk-audio-unlocked";

let unlocked = false;
const cache = new Map<DeskSound, HTMLAudioElement>();

function element(kind: DeskSound): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  let el = cache.get(kind);
  if (!el) {
    el = new Audio(DESK_SOUND_FILES[kind]);
    el.preload = "auto";
    cache.set(kind, el);
  }
  return el;
}

/** Warm the browser cache for every event sound. */
export function preloadDeskSounds() {
  if (typeof window === "undefined") return;
  for (const kind of Object.keys(DESK_SOUND_FILES) as DeskSound[]) element(kind)?.load();
}

export function isDeskAudioUnlocked() {
  return unlocked;
}

/**
 * Satisfies the browser autoplay policy. Must be called from a real user
 * gesture handler; silently plays and rewinds one clip to prime the pipeline.
 */
export function unlockDeskAudio(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const el = element("visitor");
  if (!el) return Promise.resolve(false);
  const prior = el.volume;
  el.volume = 0;
  return el
    .play()
    .then(() => {
      el.pause();
      el.currentTime = 0;
      el.volume = prior;
      unlocked = true;
      try {
        localStorage.setItem(DESK_AUDIO_UNLOCK_KEY, "1");
      } catch {
        /* storage unavailable - unlock still applies for this session */
      }
      preloadDeskSounds();
      return true;
    })
    .catch(() => {
      el.volume = prior;
      return false;
    });
}

/** Plays the distinct chime registered for this event type. */
export function playDeskSound(kind: DeskSound, enabled = true) {
  if (!enabled || typeof window === "undefined") return;
  const el = element(kind);
  if (!el) return;
  try {
    // Clone so rapid-fire events (trade pulses) can overlap instead of cutting off.
    const node = el.cloneNode(true) as HTMLAudioElement;
    node.volume = VOLUME[kind];
    void node.play().catch(() => undefined);
  } catch {
    /* playback blocked - the unlock banner prompts the operator */
  }
}
