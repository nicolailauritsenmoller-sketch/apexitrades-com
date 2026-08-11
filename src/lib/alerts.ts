/**
 * Backend alerting: loud WebAudio chimes plus desktop push notifications.
 * Browser-only — every entry point no-ops during SSR.
 */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Unlocks audio playback after the first user gesture (browser autoplay policy). */
export function unlockAudio() {
  audio();
}

type Tone = { freq: number; at: number; dur: number };

const PATTERNS: Record<string, Tone[]> = {
  // bright arrival ping
  visit: [
    { freq: 880, at: 0, dur: 0.14 },
    { freq: 1320, at: 0.12, dur: 0.18 },
  ],
  // cash register style double bell
  money: [
    { freq: 1046, at: 0, dur: 0.18 },
    { freq: 1568, at: 0.16, dur: 0.22 },
    { freq: 2093, at: 0.34, dur: 0.26 },
  ],
  // urgent compliance triple tone
  kyc: [
    { freq: 660, at: 0, dur: 0.16 },
    { freq: 660, at: 0.2, dur: 0.16 },
    { freq: 990, at: 0.4, dur: 0.24 },
  ],
  // chat bell
  chat: [
    { freq: 1200, at: 0, dur: 0.12 },
    { freq: 1600, at: 0.11, dur: 0.2 },
  ],
};

export type AlertKind = keyof typeof PATTERNS;

/** Plays a loud, distinct chime for the given event kind. */
export function playChime(kind: AlertKind, volume = 0.9) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const tone of PATTERNS[kind] ?? PATTERNS['chat']!) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(tone.freq, now + tone.at);
    gain.gain.setValueAtTime(0.0001, now + tone.at);
    gain.gain.exponentialRampToValueAtTime(volume, now + tone.at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + tone.at);
    osc.stop(now + tone.at + tone.dur + 0.05);
  }
}

/* ------------------------- looping chat alert ------------------------- */

let loopTimer: ReturnType<typeof setInterval> | null = null;

/** Repeats the chat bell until {@link stopChatLoop} is called. */
export function startChatLoop() {
  if (loopTimer) return;
  playChime("chat");
  loopTimer = setInterval(() => playChime("chat"), 2500);
}

export function stopChatLoop() {
  if (!loopTimer) return;
  clearInterval(loopTimer);
  loopTimer = null;
}

export function isChatLooping() {
  return loopTimer !== null;
}

/* --------------------------- desktop push --------------------------- */

export async function ensurePushPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  return Notification.permission;
}

export function pushNotify(title: string, body: string, tag?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, { body, tag, icon: "/favicon.ico" });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* notification construction can throw in some embedded contexts */
  }
}
