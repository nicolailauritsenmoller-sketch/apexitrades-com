import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * Global "hide balances" privacy switch.
 *
 * Persisted in localStorage and broadcast through a window event so every
 * mounted view (wallet, portfolio, assets table) flips instantly together.
 */

const KEY = "velocity.hideBalances";
const EVENT = "velocity:hide-balances";

export function readHideBalances(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setHideBalances(next: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent<boolean>(EVENT, { detail: next }));
}

/** Returns [hidden, toggle, mask] — `mask` blanks a value when hidden. */
export function useBalancePrivacy() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setHidden(readHideBalances());
    const sync = () => setHidden(readHideBalances());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback(() => setHideBalances(!readHideBalances()), []);

  const mask = useCallback(
    (value: string | number, dots = 6) => (hidden ? "•".repeat(dots) : String(value)),
    [hidden],
  );

  return { hidden, toggle, mask };
}

/** Eye / eye-off button used next to balance headers. */
export function BalancePrivacyToggle({
  hidden,
  onToggle,
  className = "",
}: {
  hidden: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const label = hidden ? "Show balances" : "Hide balances";
  const Icon = hidden ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      aria-pressed={hidden}
      className={`inline-flex size-8 touch-manipulation items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground ${className}`}
    >
      <Icon className="size-4" />
    </button>
  );
}
