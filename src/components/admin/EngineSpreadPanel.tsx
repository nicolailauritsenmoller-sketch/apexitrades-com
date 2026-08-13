import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import { getPlatformSettings, savePlatformSetting } from "@/lib/admin.functions";

const CLASSES = [
  { key: "crypto", label: "Crypto" },
  { key: "stock", label: "Stocks" },
  { key: "forex", label: "Forex" },
  { key: "metal", label: "Metals" },
  { key: "future", label: "Futures" },
] as const;

const FIELDS = [
  { key: "spreadPips", label: "Spread markup (pips/points)" },
  { key: "spreadPct", label: "Spread markup %" },
  { key: "maxOrderSize", label: "Max order size (notional)" },
  { key: "minLeverage", label: "Min leverage (x)" },
  { key: "maxLeverage", label: "Max leverage (x)" },
  { key: "slippagePct", label: "Execution slippage %" },
] as const;

/** Per-asset-class execution engine: spread padding, order caps and leverage bands. */
export function EngineSpreadPanel() {
  const read = useServerFn(getPlatformSettings);
  const write = useServerFn(savePlatformSetting);
  const [cls, setCls] = useState<string>("crypto");
  const [cfg, setCfg] = useState<Record<string, any>>({});

  const settings = useQuery({
    queryKey: ["engine-settings"],
    queryFn: () => read({ data: { keys: ["engine"] } }),
  });

  useEffect(() => {
    if (settings.data) setCfg(((settings.data as any)['engine'] ?? {}) as Record<string, any>);
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => write({ data: { key: "engine", value: cfg } }),
    onSuccess: () => {
      toast.success("Engine settings saved.");
      void settings.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const values = (cfg[cls] ?? {}) as Record<string, any>;
  const set = (field: string, v: any) =>
    setCfg((c) => ({ ...c, [cls]: { ...((c[cls] ?? {}) as object), [field]: v } }));

  return (
    <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
        <SlidersHorizontal className="size-4 text-primary" /> Trading engine & spread control
      </h3>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Markups and risk caps applied by the execution engine, per asset class.
      </p>

      <div className="mt-3 flex flex-wrap gap-1">
        {CLASSES.map((c) => (
          <button
            key={c.key}
            onClick={() => setCls(c.key)}
            className={`touch-manipulation rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              cls === c.key
                ? "bg-primary/15 text-primary"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="block min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {f.label}
            </span>
            <input
              value={values[f.key] ?? ""}
              inputMode="decimal"
              placeholder="Not set"
              onChange={(e) =>
                set(f.key, e.target.value === "" ? null : Number(e.target.value))
              }
              className="mt-1 min-h-10 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-ring"
            />
          </label>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-3">
          <span className="text-xs">Automated execution enabled</span>
          <button
            type="button"
            role="switch"
            aria-checked={cfg['autoExecution'] !== false}
            onClick={() => setCfg((c) => ({ ...c, autoExecution: c['autoExecution'] === false }))}
            className={`touch-manipulation rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${
              cfg['autoExecution'] !== false
                ? "border-bull/40 bg-bull/15 text-bull"
                : "border-bear/40 bg-bear/10 text-bear"
            }`}
          >
            {cfg['autoExecution'] !== false ? "On" : "Halted"}
          </button>
        </label>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface/50 p-3">
          <span className="text-xs">Reject orders above max size</span>
          <button
            type="button"
            role="switch"
            aria-checked={Boolean(cfg['enforceMaxSize'])}
            onClick={() => setCfg((c) => ({ ...c, enforceMaxSize: !c['enforceMaxSize'] }))}
            className={`touch-manipulation rounded-full border px-3 py-1 text-[10px] font-bold uppercase ${
              cfg['enforceMaxSize']
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground"
            }`}
          >
            {cfg['enforceMaxSize'] ? "Enforced" : "Advisory"}
          </button>
        </label>
      </div>

      <button
        onClick={() => save.mutate()}
        disabled={save.isPending}
        className="mt-4 min-h-10 touch-manipulation rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {save.isPending ? "Saving…" : "Save engine settings"}
      </button>
    </section>
  );
}
