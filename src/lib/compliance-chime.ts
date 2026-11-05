// Subtle two-tone institutional chime synthesized with the Web Audio API.
// Browsers may block audio until the operator has interacted with the page;
// failures are silent so alerts still render as toasts.
let ctx: AudioContext | null = null;

export function playComplianceChime() {
  if (typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AC) return;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    [
      { f: 880, t: 0 },
      { f: 1318.5, t: 0.14 },
    ].forEach(({ f, t }) => {
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.setValueAtTime(0, now + t);
      g.gain.linearRampToValueAtTime(1, now + t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + 0.9);
      osc.connect(g).connect(master);
      osc.start(now + t);
      osc.stop(now + t + 0.95);
    });
  } catch {
    /* audio unavailable */
  }
}

// Unlock audio on the first operator interaction so later alerts can play.
export function primeComplianceChime() {
  if (typeof window === "undefined") return () => {};
  const unlock = () => {
    try {
      const AC = window.AudioContext ?? (window as any).webkitAudioContext;
      if (!AC) return;
      ctx ??= new AC();
      if (ctx.state === "suspended") void ctx.resume();
    } catch { /* ignore */ }
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}
