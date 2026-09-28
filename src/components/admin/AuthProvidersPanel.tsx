import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Circle, Fingerprint } from "lucide-react";
import { getPlatformSettings, savePlatformSetting } from "@/lib/admin.functions";

type Field = { key: string; label: string; hint?: string };

const PROVIDERS: {
  key: string;
  label: string;
  enabledKey: string;
  fields: Field[];
  note: string;
}[] = [
  {
    key: "google",
    label: "Google OAuth",
    enabledKey: "googleEnabled",
    note: "Managed credentials are provisioned by Lovable Cloud. Add your own Client ID/Secret only if you need custom branding.",
    fields: [
      { key: "googleClientId", label: "Client ID", hint: "xxxxx.apps.googleusercontent.com" },
      { key: "googleRedirectUri", label: "Authorized redirect URI", hint: "https://<project-ref>.supabase.co/auth/v1/callback" },
      { key: "googleHostedDomain", label: "Restrict to workspace domain", hint: "example.com (optional)" },
    ],
  },
  {
    key: "apple",
    label: "Apple OAuth",
    enabledKey: "appleEnabled",
    note: "Bring-your-own setup requires a Services ID, Team ID, Key ID and .p8 private key from the Apple Developer console.",
    fields: [
      { key: "appleServiceId", label: "Services ID (Client ID)", hint: "com.yourcompany.app" },
      { key: "appleTeamId", label: "Team ID", hint: "10-character ID" },
      { key: "appleKeyId", label: "Key ID", hint: "10-character ID" },
      { key: "appleRedirectUri", label: "Return URL", hint: "https://<project-ref>.supabase.co/auth/v1/callback" },
    ],
  },
  {
    key: "email",
    label: "Email & OTP verification",
    enabledKey: "emailOtpEnabled",
    note: "Six-digit codes are sent for sign-up verification and password resets.",
    fields: [
      { key: "otpExpiryMinutes", label: "Code expiry (minutes)", hint: "10" },
      { key: "authSenderAddress", label: "Sender address", hint: "no-reply@yourdomain.com" },
    ],
  },
];

const SETTINGS_KEY = "authProviders";

function Status({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
        on ? "bg-primary/15 text-primary" : "border border-border text-muted-foreground"
      }`}
    >
      {on ? <CheckCircle2 className="size-3" /> : <Circle className="size-3" />}
      {label}
    </span>
  );
}

/** Authentication & identity provider settings for the admin operations console. */
export function AuthProvidersPanel() {
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);
  const [draft, setDraft] = useState<Record<string, any>>({});

  const settings = useQuery({
    queryKey: ["auth-providers-settings"],
    queryFn: () => read({ data: { keys: [SETTINGS_KEY] } }),
  });

  useEffect(() => {
    const stored = (settings.data as Record<string, Record<string, any>> | undefined)?.[
      SETTINGS_KEY
    ];
    setDraft({
      googleEnabled: true,
      appleEnabled: true,
      emailOtpEnabled: true,
      ...(stored ?? {}),
    });
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => write({ data: { key: SETTINGS_KEY, value: draft } }),
    onSuccess: () => {
      toast.success("Authentication settings saved.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function set(key: string, value: any) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  return (
    <section className="panel w-full max-w-full p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
          <Fingerprint className="size-4" /> Authentication & identity
        </h3>
        <div className="flex flex-wrap gap-1.5">
          <Status on={Boolean(draft.googleEnabled)} label="Google" />
          <Status on={Boolean(draft.appleEnabled)} label="Apple" />
          <Status on={Boolean(draft.emailOtpEnabled)} label="Email OTP" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {PROVIDERS.map((p) => (
          <div key={p.key} className="min-w-0 rounded-2xl border border-border bg-surface/50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">{p.label}</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(draft[p.enabledKey])}
                onClick={() => set(p.enabledKey, !draft[p.enabledKey])}
                className={`touch-manipulation rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  draft[p.enabledKey]
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {draft[p.enabledKey] ? "Active" : "Disabled"}
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{p.note}</p>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {p.fields.map((f) => (
                <label key={f.key} className="min-w-0 block">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {f.label}
                  </span>
                  <input
                    value={draft[f.key] ?? ""}
                    onChange={(e) => set(f.key, e.target.value)}
                    placeholder={f.hint ?? "Not set"}
                    className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">Provider credential checklist</p>
        <ul className="mt-1.5 list-disc space-y-1 pl-4">
          <li>Google: Client ID & Secret configured in the backend authentication providers panel.</li>
          <li>Apple: Services ID, Team ID, Key ID and .p8 private key configured in the same panel.</li>
          <li>Redirect/return URL registered with each provider must match the backend auth callback URL.</li>
          <li>Values stored here are operational documentation - live provider secrets stay in the backend auth settings.</li>
        </ul>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-4 min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save authentication settings"}
      </button>
    </section>
  );
}
