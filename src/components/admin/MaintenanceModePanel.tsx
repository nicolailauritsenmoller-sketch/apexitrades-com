import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { getPlatformSettings, savePlatformSetting } from "@/lib/admin.functions";
import { normalizeMaintenance, type MaintenanceConfig } from "@/lib/maintenance";

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Global maintenance-mode switch with custom notice copy and completion time. */
export function MaintenanceModePanel() {
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);
  const [draft, setDraft] = useState<MaintenanceConfig>(() => normalizeMaintenance(null));
  const [untilLocal, setUntilLocal] = useState("");

  const settings = useQuery({
    queryKey: ["platform-settings-maintenance"],
    queryFn: () => read({ data: { keys: ["maintenance"] } }),
  });

  useEffect(() => {
    const value = (settings.data as Record<string, unknown> | undefined)?.['maintenance'];
    if (value === undefined) return;
    const next = normalizeMaintenance(value);
    setDraft(next);
    setUntilLocal(toLocalInput(next.until));
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (next: MaintenanceConfig) =>
      write({ data: { key: "maintenance", value: next as unknown as Record<string, any> } }),
    onSuccess: (_r, next) => {
      toast.success(next.enabled ? "Maintenance mode is live." : "Platform is back online.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function persist(patch: Partial<MaintenanceConfig>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    save.mutate(next);
  }

  return (
    <section className="panel w-full max-w-full p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
            Platform maintenance mode
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Locks every non-admin visitor out of the terminal and sign-in flows.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.enabled}
          disabled={save.isPending}
          onClick={() => persist({ enabled: !draft.enabled })}
          className={`inline-flex min-h-10 touch-manipulation items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors disabled:opacity-60 ${
            draft.enabled
              ? "border-amber-500/60 bg-ops-amber-bg text-ops-amber"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldAlert className="size-4" />
          {draft.enabled ? "Maintenance mode ON" : "Enable maintenance mode"}
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Maintenance title
          </span>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className="mt-2 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Custom notice message
          </span>
          <textarea
            value={draft.message}
            rows={3}
            onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
            className="mt-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Estimated completion time
          </span>
          <input
            type="datetime-local"
            value={untilLocal}
            onChange={(e) => {
              setUntilLocal(e.target.value);
              const iso = e.target.value ? new Date(e.target.value).toISOString() : null;
              setDraft((d) => ({ ...d, until: iso }));
            }}
            className="mt-2 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
          />
        </label>
      </div>

      <button
        onClick={() => save.mutate(draft)}
        disabled={save.isPending}
        className="mt-4 min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save maintenance notice"}
      </button>
    </section>
  );
}
