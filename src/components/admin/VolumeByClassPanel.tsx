import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getVolumeByAssetClass } from "@/lib/admin-ops.functions";

const CLASSES: [string, string][] = [
  ["crypto", "Crypto"],
  ["forex", "Forex"],
  ["stock", "Stocks"],
  ["future", "Futures"],
  ["metal", "Metals"],
  ["scalp", "Scalp contracts"],
];

/** Traded notional per asset class for 24h / 7d / 30d windows. */
export function VolumeByClassPanel() {
  const fetchVol = useServerFn(getVolumeByAssetClass);
  const [w, setW] = useState<"24h" | "7d" | "30d">("7d");
  const q = useQuery({ queryKey: ["admin-volume-class"], queryFn: () => fetchVol(), refetchInterval: 30_000 });
  const b = (q.data as any)?.[w] ?? {};
  const max = Math.max(1, ...CLASSES.map(([k]) => Number(b[k] ?? 0)));
  const total = CLASSES.reduce((a, [k]) => a + Number(b[k] ?? 0), 0);
  return (
    <section className="rounded-2xl border border-border/70 bg-card/50 p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="font-display text-sm font-semibold">Trading volume by asset class</h3>
        <span className="num text-xs text-muted-foreground">Total ${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        <div className="ml-auto flex gap-1">
          {(["24h", "7d", "30d"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setW(k)}
              className={`touch-manipulation rounded-md px-2.5 py-1 text-[11px] font-semibold ${w === k ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </header>
      {q.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading volume…</p>
      ) : (
        <ul className="space-y-2">
          {CLASSES.map(([k, label]) => {
            const v = Number(b[k] ?? 0);
            return (
              <li key={k} className="grid grid-cols-[110px_1fr_110px] items-center gap-3 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${(v / max) * 100}%` }} />
                </div>
                <span className="num text-right">${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
