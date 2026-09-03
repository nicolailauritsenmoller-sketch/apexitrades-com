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
  const [, setLanguagePref] = usePreference("language", "en");
  const { lang, setLang, t } = useI18n();

  function changeLanguage(next: LangCode) {
    setLang(next);
    setLanguagePref(next);
  }

  return (
    <>
      <SubPageHeader
        title={t("common.preferences")}
        description="Currency, language and appearance."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <Section icon={Coins} title={t("common.currency")} description={t("prefs.currencyHelp")}>
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

      <Section icon={Languages} title={t("common.language")} description={t("prefs.languageHelp")}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" data-no-translate>
          {LANGUAGES.map((l) => (
            <button
              key={l.id}
              type="button"
              lang={l.id}
              onClick={() => changeLanguage(l.id as LangCode)}
              aria-pressed={lang === l.id}
              className={`flex min-h-10 touch-manipulation items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
                lang === l.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-foreground hover:bg-secondary"
              }`}
            >
              <span className="truncate">{l.native}</span>
              {lang === l.id ? <Check className="size-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      </Section>


      <Section icon={Palette} title={t("common.theme")} description={t("prefs.themeHelp")}>
        <ThemeSetting />
      </Section>
    </>
  );
}
