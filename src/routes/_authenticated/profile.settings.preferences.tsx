import { createFileRoute } from "@tanstack/react-router";
import { Coins, Languages, Palette } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { usePreference } from "@/lib/preferences";
import { ThemeSetting } from "@/lib/theme";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";

const CURRENCIES = ["USD", "EUR", "GBP", "BTC", "USDT"];


export const Route = createFileRoute("/_authenticated/profile/settings/preferences")({
  head: () => ({
    meta: [
      { title: "Display Preferences | Velocity Trade" },
      {
        name: "description",
        content:
          "Set your display currency, interface language and light or dark theme for the Velocity Trade terminal.",
      },
      { property: "og:title", content: "Display Preferences — Velocity Trade" },
      {
        property: "og:description",
        content: "Currency, language and theme controls for your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PreferenceSettings,
});

function PreferenceSettings() {
  const [currency, setCurrency] = usePreference("displayCurrency", "USD");
  const [language, setLanguage] = usePreference("language", "en");

  return (
    <>
      <SubPageHeader
        title="Preferences"
        description="Currency, language and appearance."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <Section icon={Coins} title="Display currency" description="Portfolio values are converted for display only.">
        <div className="flex flex-wrap gap-2">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              className={`min-h-9 touch-manipulation rounded-xl border px-4 text-sm font-semibold transition-colors ${
                currency === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <Section icon={Languages} title="Language" description="Interface language preference.">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          aria-label="Interface language"
          className="min-h-10 w-full touch-manipulation rounded-xl border border-border bg-background px-3 text-sm sm:max-w-xs"
        >
          {LANGUAGES.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Section>

      <Section icon={Palette} title="Theme" description="Switch between the light and dark terminal.">
        <ThemeSetting />
      </Section>
    </>
  );
}
