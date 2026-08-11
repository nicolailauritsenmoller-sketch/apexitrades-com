import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type StatKey = "totalMembers" | "countries" | "activeMembers" | "supportedMarkets";

const FIELDS: { key: StatKey; label: string }[] = [
  { key: "totalMembers", label: "Total members" },
  { key: "countries", label: "Countries represented" },
  { key: "activeMembers", label: "Active members" },
  { key: "supportedMarkets", label: "Supported markets" },
];

const EMPTY: Record<StatKey, string> = {
  totalMembers: "",
  countries: "",
  activeMembers: "",
  supportedMarkets: "",
};

const ALL_VISIBLE: Record<StatKey, boolean> = {
  totalMembers: true,
  countries: true,
  activeMembers: true,
  supportedMarkets: true,
};

/** Admin control for the homepage "Global Membership" statistics. */
export function PlatformSettingsPanel() {
  const [draft, setDraft] = useState(EMPTY);
  const [visible, setVisible] = useState(ALL_VISIBLE);
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["platform-settings", "membership"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "membership")
        .maybeSingle();
      return (data?.value ?? {}) as Record<string, any>;
    },
  });

  useEffect(() => {
    if (!data) return;
    const next = { ...EMPTY };
    const vis = { ...ALL_VISIBLE };
    for (const f of FIELDS) {
      next[f.key] = data[f.key] != null ? String(data[f.key]) : "";
      vis[f.key] = data['visible']?.[f.key] !== false;
    }
    setDraft(next);
    setVisible(vis);
  }, [data]);

  async function save() {
    setSaving(true);
    const value: Record<string, any> = { visible: {} as Record<string, boolean> };
    for (const f of FIELDS) {
      const raw = draft[f.key].trim();
      value[f.key] = raw === "" ? null : Number(raw);
      (value['visible'] as Record<string, boolean>)[f.key] = visible[f.key];
    }
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "membership", value: value as any }, { onConflict: "key" });
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
        Only verified figures should be entered. Toggle a statistic to <strong>Hidden</strong> (or
        leave it blank) to remove that metric block from the homepage.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <div key={f.key} className="min-w-0 rounded-xl border border-border bg-surface/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {f.label}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={visible[f.key]}
                onClick={() => setVisible((v) => ({ ...v, [f.key]: !v[f.key] }))}
                className={`flex touch-manipulation items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  visible[f.key]
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {visible[f.key] ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                {visible[f.key] ? "Visible" : "Hidden"}
              </button>
            </div>
            <input
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              inputMode="numeric"
              placeholder="No figure"
              className="num min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
          </div>
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
