import { useCallback, useEffect, useState } from "react";
import { readConsent } from "@/lib/consent";

/**
 * Personalization store for non-sensitive interface preferences.
 *
 * Written to first-party localStorage only when the visitor allowed functional
 * cookies, and mirrored onto the signed-in account (profiles.preferences) so
 * permitted preferences follow the user across their devices after login.
 * Never store credentials, tokens or financial data here.
 */

export type Preferences = {
  language?: string;
  displayCurrency?: string;
  timezone?: "utc" | "local";
  orderConfirmations?: boolean;
  notifyEmail?: boolean;
  notifyPush?: boolean;
  notifyTrades?: boolean;
  notifyTradeInApp?: boolean;
  notifyTradeEmail?: boolean;
  notifyTradePush?: boolean;
  notifyFundsInApp?: boolean;
  notifyFundsEmail?: boolean;
  notifyFundsPush?: boolean;
  notifySecurityInApp?: boolean;
  notifySecurityEmail?: boolean;
  notifySecurityPush?: boolean;
  notifyMarketing?: boolean;
  chartTimeframe?: string;
  preferredMarkets?: string[];
  lastSymbol?: string;
  orderLeverage?: number;
  dismissedOnboarding?: string[];
};

const KEY = "velocity.prefs";
const EVENT = "velocity:prefs";

export function functionalAllowed(): boolean {
  return readConsent()?.functional === true;
}

export function readPreferences(): Preferences {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Preferences;
  } catch {
    return {};
  }
}

export function clearPreferences() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent<Preferences>(EVENT, { detail: {} }));
}

function writePreferences(next: Preferences) {
  if (typeof window === "undefined") return;
  if (!functionalAllowed()) return; // personalization requires functional consent
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new CustomEvent<Preferences>(EVENT, { detail: next }));
  void syncToAccount(next);
}

async function syncToAccount(next: Preferences) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user.id;
    if (!uid) return;
    await supabase.from("profiles").update({ preferences: next }).eq("id", uid);
  } catch {
    /* local preference still applies */
  }
}

/** Pulls account-stored preferences down after login (cross-device restore). */
export async function restoreAccountPreferences() {
  if (!functionalAllowed()) return;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user.id;
    if (!uid) return;
    const { data } = await supabase.from("profiles").select("preferences").eq("id", uid).maybeSingle();
    const remote = (data?.preferences ?? {}) as Preferences;
    const merged = { ...remote, ...readPreferences() };
    localStorage.setItem(KEY, JSON.stringify(merged));
    window.dispatchEvent(new CustomEvent<Preferences>(EVENT, { detail: merged }));
  } catch {
    /* ignore */
  }
}

/** Reads/writes a single personalization key with consent gating. */
export function usePreference<K extends keyof Preferences>(
  key: K,
  fallback: NonNullable<Preferences[K]>,
) {
  const [value, setValue] = useState<NonNullable<Preferences[K]>>(fallback);

  useEffect(() => {
    const sync = () => {
      const stored = readPreferences()[key];
      setValue((stored ?? fallback) as NonNullable<Preferences[K]>);
    };
    sync();
    const onEvent = () => sync();
    window.addEventListener(EVENT, onEvent);
    window.addEventListener("velocity:consent-change", onEvent);
    return () => {
      window.removeEventListener(EVENT, onEvent);
      window.removeEventListener("velocity:consent-change", onEvent);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: NonNullable<Preferences[K]>) => {
      setValue(next);
      writePreferences({ ...readPreferences(), [key]: next });
    },
    [key],
  );

  return [value, update] as const;
}
