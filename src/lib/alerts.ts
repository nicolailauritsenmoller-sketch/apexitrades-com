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
  // upbeat ascending chime for a profitable settlement
  win: [
    { freq: 880, at: 0, dur: 0.12, type: "triangle" },
    { freq: 1318, at: 0.12, dur: 0.12, type: "triangle" },
    { freq: 1760, at: 0.24, dur: 0.26, type: "triangle" },
  ],
  // subdued descending tone for a losing / liquidated settlement
  loss: [
    { freq: 440, at: 0, dur: 0.16, type: "sine" },
    { freq: 330, at: 0.16, dur: 0.22, type: "sine" },
    { freq: 220, at: 0.36, dur: 0.3, type: "sine" },
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


/**
 * Soft, elegant iPhone "Aurora"-style entry chime — a gentle bell arpeggio with
 * a long shimmering tail. Used for first visits and successful logins.
 */
export function playAurora(volume = 0.35) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const notes = [
    { f: 880, at: 0 },
    { f: 1174.7, at: 0.16 },
    { f: 1567.98, at: 0.32 },
    { f: 2093, at: 0.48 },
  ];
  for (const n of notes) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(n.f, now + n.at);
    gain.gain.setValueAtTime(0.0001, now + n.at);
    gain.gain.exponentialRampToValueAtTime(volume, now + n.at + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + n.at + 1.1);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + n.at);
    osc.stop(now + n.at + 1.2);
  }
}

/* ---------------------- speech synthesis announcements -------------------- */

const SIRI_VOICES = ["Samantha", "Karen", "Victoria", "Ava", "Serena", "Google US English"];
const ZH_VOICES = ["Tingting", "Ting-Ting", "Meijia", "Sinji", "Google 普通话", "Huihui", "Yaoyao"];

/** Spoken alert for a new inbound customer message (Mandarin). */
export const CHAT_ALERT_PHRASE = "来自客户的新消息";

function isZh(text: string) {
  return /[\u4e00-\u9fff]/.test(text);
}

function pickVoice(zh = false): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (zh) {
    for (const name of ZH_VOICES) {
      const hit = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
      if (hit) return hit;
    }
    const cn = voices.find((v) => /^zh[-_]?(cn|hans)/i.test(v.lang)) ?? voices.find((v) => v.lang.toLowerCase().startsWith("zh"));
    if (cn) return cn;
  }
  for (const name of SIRI_VOICES) {
    const hit = voices.find((v) => v.name.toLowerCase().includes(name.toLowerCase()));
    if (hit) return hit;
  }
  return (
    voices.find((v) => /female|woman|zira|susan/i.test(v.name) && v.lang.startsWith("en")) ??
    voices.find((v) => v.lang.startsWith("en")) ??
    voices[0] ??
    null
  );
}

/** Speaks a phrase once, picking a Mandarin voice for Chinese text. */
export function speak(text: string, retried = false) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  // Voices load asynchronously on first use; retry once they arrive.
  if (!retried && window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.addEventListener("voiceschanged", () => speak(text, true), {
      once: true,
    });
  }
  try {
    const zh = isZh(text);
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(zh);
    if (voice) u.voice = voice;
    u.lang = zh ? (voice?.lang ?? "zh-CN") : (voice?.lang ?? "en-US");
    u.pitch = 1.1;
    u.rate = zh ? 0.96 : 1.02;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* speech synthesis unavailable */
  }
}

let speechTimer: ReturnType<typeof setInterval> | null = null;

/** Repeats a spoken announcement every 3.5s until {@link stopSpeechLoop}. */
export function startSpeechLoop(text = CHAT_ALERT_PHRASE) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (speechTimer) return;
  speak(text);
  speechTimer = setInterval(() => speak(text), 3500);
}

export function stopSpeechLoop() {
  if (speechTimer) {
    clearInterval(speechTimer);
    speechTimer = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------- looping chat alert ------------------------- */

let loopTimer: ReturnType<typeof setInterval> | null = null;

/** Repeats the chat bell + spoken alert until {@link stopChatLoop} is called. */
export function startChatLoop() {
  startSpeechLoop();
  if (loopTimer) return;
  playChime("chat");
  loopTimer = setInterval(() => playChime("chat"), 1800);
}

export function stopChatLoop() {
  stopSpeechLoop();
  if (!loopTimer) return;
  clearInterval(loopTimer);
  loopTimer = null;
}

export function isChatLooping() {
  return loopTimer !== null;
}

/* ------------------- active conversation tracking ------------------- */

let activeChatSession: string | null = null;

/**
 * Registers the conversation currently open in the support desk. Messages that
 * land in this thread while the tab is focused get a single subtle chime
 * instead of restarting the looping bell.
 */
export function setActiveChatSession(sessionId: string | null) {
  activeChatSession = sessionId;
  if (sessionId) silenceChatAlerts();
}

export function getActiveChatSession() {
  return activeChatSession;
}

/** True when the given thread is open and the admin is actually looking at it. */
export function isChatSessionWatched(sessionId?: string | null) {
  if (typeof document === "undefined") return false;
  if (!sessionId || sessionId !== activeChatSession) return false;
  return document.visibilityState === "visible" && document.hasFocus();
}

/** Quiet one-shot ping for a message inside the already-open conversation. */
export function playSoftPing() {
  playChime("chat", 0.18);
}


/**
 * Hard mute for the chat bell: stops any looping audio right away and tells the
 * rest of the console (badges, unread counters) that the desk has been focused.
 * Safe to call repeatedly and during SSR.
 */
export function silenceChatAlerts() {
  stopChatLoop();
  stopSpeechLoop();
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
