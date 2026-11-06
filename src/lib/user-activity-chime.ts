// Dedicated short three-note activity motif, separate from compliance alerts.
let context: AudioContext | null = null;

function audioContext() {
  const Audio = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return null;
  if (!context || context.state === "closed") context = new Audio();
  return context;
}

export function primeUserActivityChime() {
  const unlock = () => {
    try {
      const ctx = audioContext();
      if (ctx?.state === "suspended") void ctx.resume().catch(() => {});
    } catch { /* Audio is optional. */ }
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("keydown", unlock);
  return () => {
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
}

export function playUserActivityChime() {
  // Never queue blocked alerts to play later on the operator's next click.
  const ctx = context;
  if (!ctx || ctx.state !== "running") return;
  try {
    const master = ctx.createGain();
    master.gain.value = 0.08;
    master.connect(ctx.destination);
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const start = ctx.currentTime + index * 0.09;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(1, start + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      oscillator.connect(envelope).connect(master);
      oscillator.onended = () => {
        oscillator.disconnect();
        envelope.disconnect();
        if (index === 2) master.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.32);
    });
  } catch { /* Audio failures must not affect the console. */ }
}