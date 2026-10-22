const RECOVERY_KEY = "velocity:chunk-recovery-at";
const RETRY_WINDOW_MS = 60_000;

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk .+ failed/i.test(message);
}

export function claimChunkRecovery(storage: Pick<Storage, "getItem" | "setItem">, now: number): boolean {
  const previous = storage.getItem(RECOVERY_KEY);
  if (previous !== null && now - Number(previous) < RETRY_WINDOW_MS) return false;
  storage.setItem(RECOVERY_KEY, String(now));
  return true;
}

export function recoverChunkLoad(error: unknown): boolean {
  if (typeof window === "undefined" || !navigator.onLine || !isChunkLoadError(error)) return false;
  try {
    if (!claimChunkRecovery(window.sessionStorage, Date.now())) return false;
  } catch {
    // Without storage we cannot guard against a reload loop. Offer manual retry instead.
    return false;
  }
  window.location.reload();
  return true;
}

let installed = false;
export function installChunkRecovery(): void {
  if (typeof window === "undefined" || installed) return;
  installed = true;
  window.addEventListener("vite:preloadError", (event) => {
    const payload = (event as Event & { payload?: unknown }).payload;
    if (recoverChunkLoad(payload)) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (recoverChunkLoad(event.reason)) event.preventDefault();
  });
}