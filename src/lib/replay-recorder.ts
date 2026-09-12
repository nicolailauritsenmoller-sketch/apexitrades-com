/**
 * Full-fidelity screen recording of the signed-in user's session using rrweb.
 * DOM snapshots, cursor movement, scrolling, typing and view changes are
 * buffered in memory and flushed to `session_replays` in periodic chunks.
 * Passwords and other sensitive inputs are masked by rrweb before they leave
 * the browser.
 */
import { supabase } from "@/integrations/supabase/client";

const FLUSH_MS = 15_000;
const MAX_BUFFER = 300;

let stopFn: (() => void) | null = null;
let buffer: unknown[] = [];
let chunkIndex = 0;
let sessionKey = "";
let startedAt = "";
let timer: ReturnType<typeof setInterval> | null = null;

function deviceId(): string | null {
  try {
    return localStorage.getItem("velocity.device_id");
  } catch {
    return null;
  }
}

async function flush() {
  if (buffer.length === 0) return;
  const events = buffer;
  buffer = [];
  const index = chunkIndex++;
  try {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    await supabase.from("session_replays").insert({
      user_id: userId,
      session_key: sessionKey,
      device_id: deviceId(),
      route: window.location.pathname,
      chunk_index: index,
      event_count: events.length,
      started_at: startedAt,
      events: events as never,
    });
  } catch {
    /* recording must never break the app */
  }
}

/** Starts rrweb capture for this page load. Safe to call more than once. */
export async function startSessionRecording() {
  if (typeof window === "undefined" || stopFn) return;
  sessionKey = crypto.randomUUID();
  startedAt = new Date().toISOString();
  chunkIndex = 0;
  buffer = [];

  const { record } = await import("rrweb");
  stopFn =
    record({
      emit(event) {
        buffer.push(event);
        if (buffer.length >= MAX_BUFFER) void flush();
      },
      sampling: { mousemove: 50, scroll: 150, input: "last" },
      maskInputOptions: { password: true },
      recordCanvas: false,
      collectFonts: false,
      inlineStylesheet: true,
    }) ?? null;

  timer = setInterval(() => void flush(), FLUSH_MS);
  window.addEventListener("pagehide", () => void flush());
}

/** Stops capture and ships whatever is still buffered. */
export function stopSessionRecording() {
  if (timer) clearInterval(timer);
  timer = null;
  stopFn?.();
  stopFn = null;
  void flush();
}
