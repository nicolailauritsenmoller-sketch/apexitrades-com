import { useMemo, useRef, useState } from "react";
import { ChevronDown, Search, Check } from "lucide-react";
import { AssetIcon } from "@/lib/asset-icons";
import { INSTRUMENT_MAP, displaySymbol } from "@/lib/instruments";
import { assetName } from "@/lib/transactions";

export type AssetOption = { code: string; group: string };

function labelFor(code: string) {
  const inst = INSTRUMENT_MAP[code];
  return {
    ticker: inst ? displaySymbol(code) : code,
    name: inst ? inst.name : assetName(code),
  };
}

function useDismiss(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  return {
    ref,
    onBlur: (e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onClose();
    },
  };
}

/** Searchable asset selector rendering the authentic brand logo for every option. */
export function AssetPicker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (code: string) => void;
  options: AssetOption[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dismiss = useDismiss(() => setOpen(false));

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, string[]>();
    for (const o of options) {
      const { ticker, name } = labelFor(o.code);
      if (q && !`${ticker} ${name} ${o.code}`.toLowerCase().includes(q)) continue;
      const list = map.get(o.group) ?? [];
      list.push(o.code);
      map.set(o.group, list);
    }
    return [...map.entries()];
  }, [options, query]);

  const current = labelFor(value);

  return (
    <div className="relative" ref={dismiss.ref} onBlur={dismiss.onBlur}>
      {label && (
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</span>
      )}
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen((v) => !v);
        }}
        className="mt-1 flex w-full items-center gap-2.5 rounded-md bg-secondary px-3 py-2.5 text-left outline-none focus:ring-2 focus:ring-primary/40"
      >
        <AssetIcon symbol={value} currency={value} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{current.ticker}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{current.name}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-border bg-background shadow-xl">
          <div className="sticky top-0 flex items-center gap-2 border-b border-border bg-background px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assets"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {groups.map(([group, codes]) => (
            <div key={group}>
              <div className="bg-secondary/50 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                {group}
              </div>
              {codes.map((code) => {
                const { ticker, name } = labelFor(code);
                return (
                  <button
                    key={code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(code);
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                  >
                    <AssetIcon symbol={code} currency={code} size={24} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{ticker}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">{name}</span>
                    </span>
                    {code === value && <Check className="size-4 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
          ))}
          {groups.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No assets found.</p>
          )}
        </div>
      )}
    </div>
  );
}
