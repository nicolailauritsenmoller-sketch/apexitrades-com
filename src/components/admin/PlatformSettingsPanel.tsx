import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Membership = {
  totalMembers: number | null;
  countries: number | null;
  activeMembers: number | null;
  supportedMarkets: number | null;
};

const FIELDS: { key: keyof Membership; label: string }[] = [
  { key: "totalMembers", label: "Total members" },
  { key: "countries", label: "Countries represented" },
  { key: "activeMembers", label: "Active members" },
  { key: "supportedMarkets", label: "Supported markets" },
];

const EMPTY: Record<keyof Membership, string> = {
  totalMembers: "",
  countries: "",
  activeMembers: "",
  supportedMarkets: "",
};

/** Admin control for the homepage "Global Membership" statistics. Blank = hidden on the site. */
export function PlatformSettingsPanel() {
  const [draft, setDraft] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["platform-settings", "membership"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "membership")
        .maybeSingle();
      return (data?.value ?? {}) as Partial<Membership>;
    },
  });

  useEffect(() => {
    if (!data) return;
    setDraft({
      totalMembers: data.totalMembers != null ? String(data.totalMembers) : "",
      countries: data.countries != null ? String(data.countries) : "",
      activeMembers: data.activeMembers != null ? String(data.activeMembers) : "",
      supportedMarkets: data.supportedMarkets != null ? String(data.supportedMarkets) : "",
    });
  }, [data]);

  async function save() {
    setSaving(true);
    const value: Record<string, number | null> = {};
    for (const f of FIELDS) {
      const raw = draft[f.key].trim();
      value[f.key] = raw === "" ? null : Number(raw);
    }
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "membership", value }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Membership statistics updated");
      void refetch();
    }
  }

  return (
    <section className="panel w-full max-w-full p-4">
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
        Homepage · Global Membership statistics
      </h3>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Only verified figures should be entered. Leave a field blank to hide that statistic on the
        homepage instead of showing an unverified number.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className="min-w-0 text-xs">
            <span className="mb-1.5 block uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <input
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              inputMode="numeric"
              placeholder="Hidden"
              className="num min-h-10 w-full rounded-xl border border-input bg-surface px-3 text-sm outline-none focus:border-ring"
            />
          </label>
        ))}
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-4 min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save statistics"}
      </button>
    </section>
  );
}
