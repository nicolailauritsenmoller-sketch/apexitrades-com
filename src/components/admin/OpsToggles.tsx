import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDownToLine, ArrowUpFromLine, Gauge, Wrench } from "lucide-react";
import { getPlatformSettings, savePlatformSetting } from "@/lib/admin.functions";

type ToggleKey = "maintenanceMode" | "depositsLocked" | "withdrawalsLocked" | "tradingPaused";

const TOGGLES: { key: ToggleKey; label: string; hint: string; icon: any }[] = [
  {
    key: "maintenanceMode",
    label: "System maintenance mode",
    hint: "Show a maintenance notice platform-wide",
    icon: Wrench,
  },
  {
    key: "depositsLocked",
    label: "Deposit lock",
    hint: "Block new deposit submissions",
    icon: ArrowDownToLine,
  },
  {
    key: "withdrawalsLocked",
    label: "Withdrawal lock",
    hint: "Block new withdrawal requests",
    icon: ArrowUpFromLine,
  },
  {
    key: "tradingPaused",
    label: "Trading engine pause",
    hint: "Suspend new trade execution",
    icon: Gauge,
  },
];

/** Quick global kill-switches for platform operations. */
export function OpsToggles() {
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);
  const [state, setState] = useState<Record<string, boolean>>({});

  const settings = useQuery({
    queryKey: ["platform-settings-ops"],
    queryFn: () => read({ data: { keys: ["ops"] } }),
  });

  useEffect(() => {
    const ops = (settings.data as any)?.ops;
    if (ops) setState(ops as Record<string, boolean>);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: (next: Record<string, boolean>) => write({ data: { key: "ops", value: next } }),
    onSuccess: () => {
      toast.success("Operations controls updated.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(key: ToggleKey) {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    save.mutate(next);
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-b from-card/80 to-card/40 p-4 backdrop-blur">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <h3 className="text-xs uppercase tracking-widest text-muted-foreground">
        Maintenance & feature toggles
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {TOGGLES.map(({ key, label, hint, icon: Icon }) => {
          const on = Boolean(state[key]);
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={on}
              disabled={save.isPending}
              onClick={() => toggle(key)}
              className={`flex touch-manipulation items-start gap-3 rounded-xl border p-3 text-left transition-all hover:-translate-y-0.5 disabled:opacity-60 ${
                on
                  ? "border-amber-500/60 bg-amber-500/10 shadow-[0_0_18px_-6px_rgba(245,158,11,0.7)]"
                  : "border-border bg-background/40 hover:border-primary/40"
              }`}
            >
              <Icon className={`mt-0.5 size-4 shrink-0 ${on ? "text-amber-400" : "text-muted-foreground"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{label}</span>
                <span className="block text-[11px] text-muted-foreground">{hint}</span>
              </span>
              <span
                className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  on ? "bg-amber-500/20 text-amber-400" : "bg-secondary text-muted-foreground"
                }`}
              >
                {on ? "On" : "Off"}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
