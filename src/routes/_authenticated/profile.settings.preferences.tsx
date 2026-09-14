import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Coins, Crown, Languages, Palette } from "lucide-react";
import { Section, SubPageHeader } from "@/components/profile/ui";
import { usePreference } from "@/lib/preferences";
import { useDisplayCurrency, DISPLAY_CURRENCIES } from "@/lib/display-currency";
import { DisplayCurrencyDialog } from "@/components/DisplayCurrencyDialog";
import { ThemeSetting } from "@/lib/theme";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { logActivity } from "@/lib/telemetry";




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
  const { currency } = useDisplayCurrency();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [, setLanguagePref] = usePreference("language", "en");
  const { lang, setLang, t } = useI18n();

  function changeLanguage(next: LangCode) {
    setLang(next);
    setLanguagePref(next);
    void logActivity("settings", `Changed language to ${next}`, { setting: "language", value: next });
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
              onClick={() => {
                setCurrency(c);
                void logActivity("settings", `Changed display currency to ${c}`, {
                  setting: "displayCurrency",
                  value: c,
                });
              }}
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
        <div data-no-translate>
          <Select value={lang} onValueChange={(v) => changeLanguage(v as LangCode)}>
            <SelectTrigger className="min-h-11 w-full touch-manipulation rounded-xl border-border bg-background px-4 text-base font-semibold text-foreground focus:ring-1 focus:ring-primary">
              <SelectValue placeholder={t("common.language")} />
            </SelectTrigger>
            <SelectContent className="max-h-72 rounded-xl border-border bg-popover">
              {LANGUAGES.map((l) => (
                <SelectItem
                  key={l.id}
                  value={l.id}
                  lang={l.id}
                  className="min-h-10 cursor-pointer text-base font-medium"
                >
                  {l.native}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>


      <Section icon={Palette} title={t("common.theme")} description={t("prefs.themeHelp")}>
        <ThemeSetting />
      </Section>

      <Link
        to="/vip-upgrade"
        className="flex touch-manipulation items-center gap-3 rounded-2xl border border-amber-500/30 bg-card px-4 py-4 transition-colors hover:bg-secondary"
      >
        <Crown className="size-[18px] shrink-0 text-amber-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Upgrade to VIP</span>
          <span className="block text-xs text-muted-foreground">
            Zero fees, priority account manager and elevated limits.
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </>
  );
}
