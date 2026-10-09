import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getPlatformSettings, savePlatformSetting } from "@/lib/admin.functions";

type Field = {
  key: string;
  label: string;
  kind?: "text" | "number" | "toggle" | "secret" | "select";
  hint?: string;
  options?: string[];
};

type Group = { key: string; label: string; fields: Field[]; testEmail?: boolean };

const GROUPS: Group[] = [
  {
    key: "general",
    label: "General",
    fields: [
      { key: "siteName", label: "Site name" },
      { key: "logoUrl", label: "Platform logo URL" },
      { key: "contactEmail", label: "Contact email" },
      { key: "defaultCurrency", label: "Default currency", hint: "e.g. USDT" },
    ],
  },
  {
    key: "trading",
    label: "Trading & risk",
    fields: [
      { key: "makerFeePct", label: "Default maker fee %", kind: "number", hint: "e.g. 0.02" },
      { key: "takerFeePct", label: "Default taker fee %", kind: "number", hint: "e.g. 0.05" },
      { key: "spreadPct", label: "Spread markup %", kind: "number" },
      { key: "maxDefaultLeverage", label: "Maximum default leverage", kind: "select", options: ["50x", "100x", "200x"] },
      { key: "defaultLeverage", label: "Default leverage ratio", kind: "number" },
      { key: "minTradeAmount", label: "Minimum trade amount", kind: "number" },
      { key: "maxTradeAmount", label: "Maximum trade amount", kind: "number" },
      { key: "slippagePct", label: "Automated trade slippage %", kind: "number" },
    ],
  },
  {
    key: "payments",
    label: "Payments & wallets",
    fields: [
      { key: "unverifiedDailyLimit", label: "Unverified account daily limit ($)", kind: "number" },
      { key: "tier1DailyWithdrawalLimit", label: "Verified (Tier 1) daily withdrawal limit ($)", kind: "number" },
      { key: "vipDailyWithdrawalLimit", label: "VIP (Tier 2) daily withdrawal limit ($)", kind: "number" },
      { key: "withdrawalAutoApproveBelow", label: "Withdrawal auto-approval threshold ($)", kind: "number", hint: "e.g. 500" },
      { key: "depositFeePct", label: "Deposit fee %", kind: "number" },
      { key: "withdrawalFeePct", label: "Withdrawal fee %", kind: "number" },
      { key: "minDeposit", label: "Minimum deposit", kind: "number" },
      { key: "minWithdrawal", label: "Minimum withdrawal", kind: "number" },
      { key: "maxDeposit", label: "Maximum deposit per transaction", kind: "number" },
      { key: "maxWithdrawal", label: "Maximum withdrawal per transaction", kind: "number" },
      { key: "dailyDepositLimit", label: "Daily deposit limit", kind: "number" },
      { key: "dailyWithdrawalLimit", label: "Daily withdrawal limit", kind: "number" },
      { key: "autoApproveBelow", label: "Deposit auto-approval threshold", kind: "number" },
      { key: "bankDetails", label: "Bank transfer details" },
    ],
  },
  {
    key: "security",
    label: "Security & compliance",
    fields: [
      { key: "forceKyc", label: "Force mandatory KYC", kind: "toggle" },
      { key: "sessionTimeoutMinutes", label: "Session timeout (minutes)", kind: "number" },
      { key: "enforce2fa", label: "Enforce two-factor authentication", kind: "toggle" },
      { key: "maxLoginAttempts", label: "Max login attempts", kind: "number" },
    ],
  },
  {
    key: "integrations",
    label: "System & API",
    fields: [
      { key: "providerName", label: "API provider name" },
      { key: "apiSecret", label: "API secret / token", kind: "secret" },
      { key: "webhookUrl", label: "Webhook callback URL", hint: "https://..." },
      { key: "ipWhitelist", label: "IP whitelist", hint: "Comma-separated IPs" },
    ],
  },
  {
    key: "smtp",
    label: "SMTP mail server",
    testEmail: true,
    fields: [
      { key: "host", label: "SMTP host", hint: "smtp.example.com" },
      { key: "port", label: "Port", kind: "number", hint: "587" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", kind: "secret" },
      { key: "senderEmail", label: "Sender email", hint: "no-reply@example.com" },
    ],
  },
];

const KEYS = GROUPS.map((g) => g.key);

/** Comprehensive, backend-persisted platform configuration hub. */
export function PlatformSettingsHub() {
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);
  const [tab, setTab] = useState(GROUPS[0]!.key);
  const [draft, setDraft] = useState<Record<string, Record<string, any>>>({});

  const settings = useQuery({
    queryKey: ["platform-settings-hub"],
    queryFn: () => read({ data: { keys: KEYS } }),
  });

  useEffect(() => {
    if (settings.data) setDraft(settings.data as Record<string, Record<string, any>>);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (group: string) => write({ data: { key: group, value: draft[group] ?? {} } }),
    onSuccess: () => {
      toast.success("Settings saved.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const group = GROUPS.find((g) => g.key === tab)!;
  const values = draft[group.key] ?? {};

  function set(field: string, value: any) {
    setDraft((d) => ({ ...d, [group.key]: { ...(d[group.key] ?? {}), [field]: value } }));
  }

  return (
    <section className="panel w-full max-w-full p-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
        Platform settings
      </h3>

      <div className="mt-3 flex flex-wrap gap-1">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setTab(g.key)}
            className={`touch-manipulation rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === g.key
                ? "bg-primary/15 text-primary"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {group.fields.map((f) => (
          <div key={f.key} className="min-w-0 rounded-xl border border-border bg-surface/50 p-3">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            {f.kind === "toggle" ? (
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(values[f.key])}
                onClick={() => set(f.key, !values[f.key])}
                className={`mt-2 flex touch-manipulation items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  values[f.key]
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {values[f.key] ? "Enabled" : "Disabled"}
              </button>
            ) : f.kind === "select" ? (
              <select
                value={values[f.key] ?? ""}
                onChange={(e) => set(f.key, e.target.value || null)}
                className="mt-2 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              >
                <option value="">Not set</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input
                type={f.kind === "secret" ? "password" : "text"}
                autoComplete="off"
                value={values[f.key] ?? ""}
                inputMode={f.kind === "number" ? "decimal" : "text"}
                onChange={(e) =>
                  set(
                    f.key,
                    f.kind === "number"
                      ? e.target.value === ""
                        ? null
                        : Number(e.target.value)
                      : e.target.value,
                  )
                }
                placeholder={f.hint ?? "Not set"}
                className="mt-2 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
        {group.testEmail && (
          <button
            type="button"
            onClick={() =>
              values["host"] && values["senderEmail"]
                ? toast.info("SMTP details saved. Live test delivery is not connected yet.")
                : toast.error("Enter host and sender email first.")
            }
            className="min-h-10 touch-manipulation rounded-xl border border-border px-5 text-sm font-semibold"
          >
            Send Test Email
          </button>
        )}
        <button
          onClick={() => save.mutate(group.key)}
          disabled={save.isPending}
          className="min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {save.isPending ? "Saving..." : `Save ${group.label.toLowerCase()} settings`}
        </button>
      </div>
    </section>
  );
}
