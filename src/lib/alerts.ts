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

type Tone = { freq: number; at: number; dur: number; type?: OscillatorType };

const PATTERNS: Record<string, Tone[]> = {
  // "keys" — crisp, clicky arrival tone for visits / live sessions
  visit: [
    { freq: 1760, at: 0, dur: 0.05, type: "square" },
    { freq: 2349, at: 0.06, dur: 0.06, type: "square" },
    { freq: 1568, at: 0.14, dur: 0.05, type: "square" },
  ],
  // "glass" — bright struck-glass tone for deposits / withdrawals
  money: [
    { freq: 1318, at: 0, dur: 0.35, type: "sine" },
    { freq: 1975, at: 0.02, dur: 0.4, type: "sine" },
    { freq: 2637, at: 0.05, dur: 0.5, type: "sine" },
  ],
  // "pulse" — insistent compliance pulse for KYC submissions
  kyc: [
    { freq: 520, at: 0, dur: 0.12, type: "sawtooth" },
    { freq: 520, at: 0.18, dur: 0.12, type: "sawtooth" },
    { freq: 520, at: 0.36, dur: 0.12, type: "sawtooth" },
    { freq: 780, at: 0.54, dur: 0.22, type: "sawtooth" },
  ],
  // "bell" — ringing chat bell, looped until the desk is opened
  chat: [
    { freq: 2093, at: 0, dur: 0.18, type: "triangle" },
    { freq: 2793, at: 0.1, dur: 0.3, type: "triangle" },
    { freq: 2093, at: 0.34, dur: 0.3, type: "triangle" },
  ],
  // "electronic" — synthetic execution blip for trades / scalp contracts
  trade: [
    { freq: 660, at: 0, dur: 0.08, type: "square" },
    { freq: 990, at: 0.08, dur: 0.08, type: "square" },
    { freq: 1320, at: 0.16, dur: 0.14, type: "square" },
  ],
};

export type AlertKind = keyof typeof PATTERNS;

/** Plays a loud, distinct chime for the given event kind. */
export function playChime(kind: AlertKind, volume = 0.95) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  for (const tone of PATTERNS[kind] ?? PATTERNS['chat']!) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = tone.type ?? "triangle";
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
  loopTimer = setInterval(() => playChime("chat"), 1800);
}

export function stopChatLoop() {
  if (!loopTimer) return;
  clearInterval(loopTimer);
  loopTimer = null;
}

export function isChatLooping() {
  return loopTimer !== null;
}

/**
 * Hard mute for the chat bell: stops any looping audio right away and tells the
 * rest of the console (badges, unread counters) that the desk has been focused.
 * Safe to call repeatedly and during SSR.
 */
export function silenceChatAlerts() {
  stopChatLoop();
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("desk:chat-focus"));
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
