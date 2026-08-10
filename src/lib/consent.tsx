import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * First-party cookie consent store.
 *
 * Consent is persisted in a first-party cookie (SameSite=Lax, Secure on https)
 * plus a localStorage mirror. It is intentionally readable by JS (so the UI can
 * gate scripts before they load) — never store secrets here. Authentication
 * cookies/tokens are handled separately by the auth layer.
 */

export const CONSENT_COOKIE = "velocity_consent";
export const CONSENT_STORAGE_KEY = "velocity.consent";
export const CONSENT_VERSION = "v1";
const MAX_AGE_DAYS = 180;

export type ConsentCategory = "essential" | "functional" | "analytics" | "marketing";

export type ConsentState = {
  essential: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  version: string;
  decidedAt: string | null;
};

export const CATEGORY_INFO: {
  id: ConsentCategory;
  label: string;
  description: string;
  locked?: boolean;
}[] = [
  {
    id: "essential",
    label: "Essential",
    description:
      "Required for sign-in, session security, fraud prevention and core account functionality. These cannot be switched off.",
    locked: true,
  },
  {
    id: "functional",
    label: "Functional",
    description:
      "Remembers your interface choices — theme, language, chart timeframe, preferred markets and dismissed prompts.",
  },
  {
    id: "analytics",
    label: "Analytics",
    description:
      "Helps us understand aggregate product usage so we can improve the platform. No analytics run until you allow them.",
  },
  {
    id: "marketing",
    label: "Marketing",
    description:
      "Allows measurement of campaigns and relevant offers. No marketing technologies load without this consent.",
  },
];

export const DENY_ALL: ConsentState = {
  essential: true,
  functional: false,
  analytics: false,
  marketing: false,
  version: CONSENT_VERSION,
  decidedAt: null,
};

export const ACCEPT_ALL: ConsentState = {
  ...DENY_ALL,
  functional: true,
  analytics: true,
  marketing: true,
};

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function writeCookie(name: string, value: string) {
  if (typeof document === "undefined") return;
  const secure = typeof location !== "undefined" && location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${
    MAX_AGE_DAYS * 24 * 60 * 60
  }; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

function parse(raw: string | null): ConsentState | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ConsentState>;
    if (p.version !== CONSENT_VERSION) return null;
    return {
      essential: true,
      functional: !!p.functional,
      analytics: !!p.analytics,
      marketing: !!p.marketing,
      version: CONSENT_VERSION,
      decidedAt: p.decidedAt ?? null,
    };
  } catch {
    return null;
  }
}

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  const fromCookie = parse(readCookie(CONSENT_COOKIE));
  if (fromCookie) return fromCookie;
  try {
    return parse(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function persist(state: ConsentState | null) {
  if (typeof window === "undefined") return;
  if (!state) {
    deleteCookie(CONSENT_COOKIE);
    try {
      localStorage.removeItem(CONSENT_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
    return;
  }
  const raw = JSON.stringify(state);
  writeCookie(CONSENT_COOKIE, raw);
  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, raw);
  } catch {
    /* storage unavailable */
  }
}

/** Stable, first-party-only pseudonymous id used to attach a consent audit row. */
export function consentSubjectId(): string {
  if (typeof window === "undefined") return "";
  const KEY = "velocity.consent_subject";
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

type ConsentContextValue = {
  consent: ConsentState;
  decided: boolean;
  hydrated: boolean;
  save: (next: Partial<Omit<ConsentState, "essential" | "version">>, source?: string) => void;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  withdraw: () => void;
  openSettings: () => void;
  settingsOpen: boolean;
  closeSettings: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

const OPEN_EVENT = "velocity:cookie-settings";
const CHANGE_EVENT = "velocity:consent-change";

/** Anywhere in the app (e.g. footer link) can open the preference centre. */
export function openCookieSettings() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(OPEN_EVENT));
}

async function recordConsent(state: ConsentState, source: string) {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    await supabase.from("consent_records").insert({
      user_id: data.session?.user.id ?? null,
      anon_id: data.session?.user.id ? null : consentSubjectId(),
      essential: true,
      functional: state.functional,
      analytics: state.analytics,
      marketing: state.marketing,
      policy_version: CONSENT_VERSION,
      source,
    });
  } catch {
    /* consent still applies locally if the audit write fails */
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>(DENY_ALL);
  const [hydrated, setHydrated] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored) setConsent(stored);
    setHydrated(true);
    const onOpen = () => setSettingsOpen(true);
    const onChange = (e: Event) => setConsent((e as CustomEvent<ConsentState>).detail);
    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CHANGE_EVENT, onChange);
    };
  }, []);

  const commit = useCallback((next: ConsentState, source: string) => {
    setConsent(next);
    persist(next);
    window.dispatchEvent(new CustomEvent<ConsentState>(CHANGE_EVENT, { detail: next }));
    void recordConsent(next, source);
  }, []);

  const save = useCallback<ConsentContextValue["save"]>(
    (partial, source = "preferences") => {
      commit(
        {
          ...DENY_ALL,
          functional: partial.functional ?? consent.functional,
          analytics: partial.analytics ?? consent.analytics,
          marketing: partial.marketing ?? consent.marketing,
          decidedAt: new Date().toISOString(),
        },
        source,
      );
    },
    [commit, consent],
  );

  const acceptAll = useCallback(
    () => commit({ ...ACCEPT_ALL, decidedAt: new Date().toISOString() }, "accept_all"),
    [commit],
  );

  const rejectNonEssential = useCallback(
    () => commit({ ...DENY_ALL, decidedAt: new Date().toISOString() }, "reject_non_essential"),
    [commit],
  );

  const withdraw = useCallback(() => {
    persist(null);
    setConsent(DENY_ALL);
    window.dispatchEvent(new CustomEvent<ConsentState>(CHANGE_EVENT, { detail: DENY_ALL }));
    void recordConsent(DENY_ALL, "withdrawn");
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      decided: consent.decidedAt !== null,
      hydrated,
      save,
      acceptAll,
      rejectNonEssential,
      withdraw,
      openSettings: () => setSettingsOpen(true),
      closeSettings: () => setSettingsOpen(false),
      settingsOpen,
    }),
    [consent, hydrated, save, acceptAll, rejectNonEssential, withdraw, settingsOpen],
  );

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside <ConsentProvider>");
  return ctx;
}
