import { useState, type ComponentType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BellRing,
  Check,
  ChevronRight,
  Clock3,
  Coins,
  Crown,
  EyeOff,
  Globe2,
  Languages,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { SubPageHeader } from "@/components/profile/ui";
import { usePreference } from "@/lib/preferences";
import { useDisplayCurrency, DISPLAY_CURRENCIES } from "@/lib/display-currency";
import { DisplayCurrencyDialog } from "@/components/DisplayCurrencyDialog";
import { useTheme, type Theme } from "@/lib/theme";
import { useBalancePrivacy } from "@/lib/balance-privacy";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
      { property: "og:title", content: "Display Preferences - Velocity Trade" },
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
  const [timezone, setTimezone] = usePreference("timezone", "utc");
  const [orderConfirmations, setOrderConfirmations] = usePreference("orderConfirmations", true);
  const [orderLeverage, setOrderLeverage] = usePreference("orderLeverage", 1);
  const [tradeInApp, setTradeInApp] = usePreference("notifyTradeInApp", true);
  const [tradeEmail, setTradeEmail] = usePreference("notifyTradeEmail", true);
  const [tradePush, setTradePush] = usePreference("notifyTradePush", true);
  const [fundsInApp, setFundsInApp] = usePreference("notifyFundsInApp", true);
  const [fundsEmail, setFundsEmail] = usePreference("notifyFundsEmail", true);
  const [fundsPush, setFundsPush] = usePreference("notifyFundsPush", true);
  const [securityInApp, setSecurityInApp] = usePreference("notifySecurityInApp", true);
  const [securityEmail, setSecurityEmail] = usePreference("notifySecurityEmail", true);
  const [securityPush, setSecurityPush] = usePreference("notifySecurityPush", true);
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { hidden: balancesHidden, toggle: toggleBalances } = useBalancePrivacy();

  const sections = [
    { id: "display", label: "Display & Regional", icon: Globe2 },
    { id: "trading", label: "Trading Defaults", icon: SlidersHorizontal },
    { id: "notifications", label: "Notifications & Alerts", icon: BellRing },
    { id: "privacy", label: "Privacy & Security", icon: ShieldCheck },
  ];

  const notificationRows = [
    {
      label: "Trade Executions & Liquidations",
      values: [tradeInApp, tradeEmail, tradePush],
      setters: [setTradeInApp, setTradeEmail, setTradePush],
    },
    {
      label: "Deposit & Withdrawal Confirmations",
      values: [fundsInApp, fundsEmail, fundsPush],
      setters: [setFundsInApp, setFundsEmail, setFundsPush],
    },
    {
      label: "Security & Unrecognized Logins",
      values: [securityInApp, securityEmail, securityPush],
      setters: [setSecurityInApp, setSecurityEmail, setSecurityPush],
    },
  ];

  function changeLanguage(next: LangCode) {
    setLang(next);
    setLanguagePref(next);
    void logActivity("settings", `Changed language to ${next}`, { setting: "language", value: next });
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <>
      <SubPageHeader
        title="Preferences"
        description="Configure your trading environment, alerts and account privacy."
        backTo="/profile/settings"
        backLabel="Settings"
      />

      <div className="grid items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
        <nav aria-label="Preference sections" className="sticky top-16 z-10 -mx-1 flex gap-1 overflow-x-auto border-b border-border bg-background/95 px-1 py-2 backdrop-blur lg:mx-0 lg:flex-col lg:rounded-lg lg:border lg:bg-card lg:p-2">
          {sections.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              onClick={() => scrollToSection(id)}
              className="h-10 shrink-0 justify-start px-3 text-xs text-muted-foreground hover:text-foreground lg:w-full"
            >
              <Icon className="size-4" /> {label}
            </Button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
          <SettingsSection id="display" icon={Globe2} title="Display & Regional" description="Set how values, dates and the interface appear across your account.">
            <SettingRow icon={Coins} title="Local Currency" description="Account valuation and converted balances.">
              <Button type="button" variant="outline" onClick={() => setPickerOpen(true)} className="min-w-36 justify-between bg-background">
                <span>{currency} · {DISPLAY_CURRENCIES.find((item) => item.code === currency)?.name}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Button>
            </SettingRow>
            <SettingRow icon={Clock3} title="Timezone" description="Used for trading charts and transaction records.">
              <Select value={timezone} onValueChange={(value) => setTimezone(value as "utc" | "local")}>
                <SelectTrigger className="w-full bg-background sm:w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="utc">UTC (Coordinated Universal Time)</SelectItem>
                  <SelectItem value="local">Local Time</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>
            <SettingRow icon={Languages} title="Language" description="Language used throughout the interface.">
              <div className="w-full sm:w-64" data-no-translate>
                <Select value={lang} onValueChange={(value) => changeLanguage(value as LangCode)}>
                  <SelectTrigger className="w-full bg-background"><SelectValue placeholder={t("common.language")} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {LANGUAGES.map((language) => <SelectItem key={language.id} value={language.id} lang={language.id}>{language.native}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </SettingRow>
            <SettingRow icon={Palette} title="Interface Theme" description="Choose a high-contrast appearance or follow your device.">
              <div className="grid w-full grid-cols-3 rounded-md border border-border bg-background p-1 sm:w-auto">
                {([
                  { id: "dark", label: "Dark", Icon: Moon },
                  { id: "light", label: "Light", Icon: Sun },
                  { id: "system", label: "System Auto", Icon: Monitor },
                ] as { id: Theme; label: string; Icon: ComponentType<{ className?: string }> }[]).map(({ id, label, Icon }) => (
                  <Button key={id} type="button" size="sm" variant={theme === id ? "default" : "ghost"} onClick={() => setTheme(id)} className="px-2 text-[11px]">
                    <Icon className="size-3.5" /> {label}
                  </Button>
                ))}
              </div>
            </SettingRow>
          </SettingsSection>

          <SettingsSection id="trading" icon={SlidersHorizontal} title="Trading & Terminal Defaults" description="Define the standard controls applied when opening an order ticket.">
            <SettingRow icon={ShieldCheck} title="Order Confirmation Prompts" description="Require a review step before an order is submitted.">
              <Switch checked={orderConfirmations} onCheckedChange={setOrderConfirmations} aria-label="Order confirmation prompts" />
            </SettingRow>
            <SettingRow icon={SlidersHorizontal} title="Default Order Leverage" description="Preselect leverage for eligible contract orders.">
              <Select value={String(orderLeverage)} onValueChange={(value) => setOrderLeverage(Number(value))}>
                <SelectTrigger className="w-full bg-background sm:w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{[1, 5, 10, 20].map((value) => <SelectItem key={value} value={String(value)}>{value}x</SelectItem>)}</SelectContent>
              </Select>
            </SettingRow>
          </SettingsSection>

          <SettingsSection id="notifications" icon={BellRing} title="Notifications & Alerts" description="Choose where operational and account alerts reach you.">
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className="grid grid-cols-[minmax(240px,1fr)_80px_80px_80px] items-center border-b border-border px-4 pb-3 text-[11px] font-semibold uppercase text-muted-foreground">
                  <span>Event</span><span className="text-center">In-App</span><span className="text-center">Email</span><span className="text-center">Push</span>
                </div>
                {notificationRows.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(240px,1fr)_80px_80px_80px] items-center border-b border-border/70 px-4 py-4 last:border-0">
                    <span className="text-sm font-medium">{row.label}</span>
                    {row.values.map((checked, index) => (
                      <span key={index} className="flex justify-center">
                        <Switch checked={checked} onCheckedChange={row.setters[index]} aria-label={`${row.label} ${["in-app", "email", "push"][index]}`} />
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection id="privacy" icon={ShieldCheck} title="Privacy & Security" description="Control what is visible when you first open your account.">
            <SettingRow icon={EyeOff} title="Hide sensitive account balance on load" description="Mask balances across Home, Portfolio and Assets until you reveal them.">
              <Switch checked={balancesHidden} onCheckedChange={toggleBalances} aria-label="Hide sensitive account balance on load" />
            </SettingRow>
          </SettingsSection>

          <section className="relative overflow-hidden rounded-lg border border-primary/40 bg-card p-5 sm:p-6">
            <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 text-primary"><Crown className="size-5" /></span>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-primary">Priority membership</p>
                  <h2 className="mt-1 text-lg font-bold">Upgrade to VIP</h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">Access priority desk support, elevated limits and preferred trading terms.</p>
                </div>
              </div>
              <Button asChild className="h-11 shrink-0 px-5 font-semibold">
                <Link to="/vip-upgrade">Apply for VIP Status <ChevronRight className="size-4" /></Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
      <DisplayCurrencyDialog open={pickerOpen} onOpenChange={setPickerOpen} />
    </>
  );
}

function SettingsSection({ id, icon: Icon, title, description, children }: { id: string; icon: LucideIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex items-start gap-3 border-b border-border px-4 py-4 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-primary"><Icon className="size-4" /></span>
        <div><h2 className="text-base font-bold">{title}</h2><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function SettingRow({ icon: Icon, title, description, children }: { icon: LucideIcon; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div><p className="text-sm font-semibold">{title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p></div>
      </div>
      <div className="shrink-0 sm:max-w-[55%]">{children}</div>
    </div>
  );
}
