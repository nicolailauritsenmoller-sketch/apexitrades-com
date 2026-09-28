import { useEffect, useState } from "react";
import { Cookie, Shield, X } from "lucide-react";
import { CATEGORY_INFO, useConsent, type ConsentCategory } from "@/lib/consent";
import { clearPreferences } from "@/lib/preferences";

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 touch-manipulation rounded-full transition-colors ${
        checked ? "bg-primary" : "bg-secondary"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <span
        className={`absolute top-0.5 size-5 rounded-full bg-background transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Full preference centre - used by the banner's Customize action and the footer link. */
export function CookiePreferencesPanel({ onDone }: { onDone?: () => void }) {
  const { consent, save, acceptAll, rejectNonEssential, withdraw } = useConsent();
  const [draft, setDraft] = useState({
    functional: consent.functional,
    analytics: consent.analytics,
    marketing: consent.marketing,
  });

  useEffect(() => {
    setDraft({
      functional: consent.functional,
      analytics: consent.analytics,
      marketing: consent.marketing,
    });
  }, [consent]);

  const set = (id: ConsentCategory, v: boolean) =>
    setDraft((d) => ({ ...d, [id]: v }) as typeof draft);

  return (
    <div className="w-full max-w-full space-y-3">
      {CATEGORY_INFO.map((c) => (
        <div
          key={c.id}
          className="flex w-full max-w-full items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {c.label}
              {c.locked && (
                <span className="ml-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Always on
                </span>
              )}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
          </div>
          <Toggle
            label={`${c.label} cookies`}
            checked={c.locked ? true : draft[c.id as "functional" | "analytics" | "marketing"]}
            disabled={c.locked}
            onChange={(v) => set(c.id, v)}
          />
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            save(draft, "customize");
            onDone?.();
          }}
          className="min-h-10 flex-1 touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
        >
          Save preferences
        </button>
        <button
          onClick={() => {
            acceptAll();
            onDone?.();
          }}
          className="min-h-10 flex-1 touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
        >
          Accept all
        </button>
        <button
          onClick={() => {
            rejectNonEssential();
            onDone?.();
          }}
          className="min-h-10 flex-1 touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
        >
          Reject non-essential
        </button>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-3 text-xs">
        <button
          onClick={() => {
            withdraw();
            onDone?.();
          }}
          className="touch-manipulation rounded-lg border border-border px-3 py-2 text-muted-foreground hover:text-foreground"
        >
          Withdraw consent
        </button>
        <button
          onClick={() => clearPreferences()}
          className="touch-manipulation rounded-lg border border-border px-3 py-2 text-muted-foreground hover:text-foreground"
        >
          Clear personalization settings
        </button>
      </div>
    </div>
  );
}

/** Banner + modal. Mounted once at the app root. */
export function CookieConsent() {
  const { decided, hydrated, acceptAll, rejectNonEssential, settingsOpen, openSettings, closeSettings } =
    useConsent();

  if (!hydrated) return null;
  const showBanner = !decided && !settingsOpen;

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-label="Cookie consent"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] w-full max-w-full px-3 pb-[calc(env(safe-area-inset-bottom)+76px)] md:px-6 md:pb-6"
        >
          <div className="pointer-events-auto mx-auto flex w-full max-w-5xl flex-col gap-3 rounded-2xl border border-border bg-popover/98 p-4 shadow-2xl backdrop-blur-xl md:flex-row md:items-center">

            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Cookie className="size-4" />
              </span>
              <p className="min-w-0 text-xs leading-relaxed text-muted-foreground">
                We use essential cookies to keep your account and session secure. With your
                permission we also use functional, analytics and marketing cookies to personalize
                the platform. No non-essential technology loads before you choose.
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto md:shrink-0">
              <button
                onClick={acceptAll}
                className="min-h-10 touch-manipulation rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                Accept all
              </button>
              <button
                onClick={rejectNonEssential}
                className="min-h-10 touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
              >
                Reject non-essential
              </button>
              <button
                onClick={openSettings}
                className="min-h-10 touch-manipulation rounded-xl border border-border px-4 text-sm font-semibold hover:bg-secondary"
              >
                Customize
              </button>
            </div>
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-background/70 p-3 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-popover p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Shield className="size-4 text-primary" /> Privacy & cookie settings
              </h2>
              <button
                onClick={closeSettings}
                aria-label="Close cookie settings"
                className="grid size-8 touch-manipulation place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <CookiePreferencesPanel onDone={closeSettings} />
          </div>
        </div>
      )}
    </>
  );
}
