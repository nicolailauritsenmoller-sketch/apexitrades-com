import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { INSTRUMENTS, ASSET_CLASS_LABEL, displaySymbol } from "@/lib/instruments";

/** Global asset search — opens with Ctrl/⌘ + K and routes to the trade terminal. */
export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, typeof INSTRUMENTS>();
    for (const i of INSTRUMENTS) {
      const key = i.assetClass === "crypto" ? "Spot" : i.assetClass === "future" ? "Perpetuals & Futures" : ASSET_CLASS_LABEL[i.assetClass];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(i);
    }
    return [...map.entries()];
  }, []);

  const go = (symbol: string) => {
    setOpen(false);
    void navigate({ to: "/terminal/$symbol", params: { symbol } });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search assets"
        className="flex touch-manipulation items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline">Search assets</span>
        <kbd className="hidden rounded border border-border px-1 font-mono text-[10px] lg:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search spot, perpetuals, stocks, forex…" />
        <CommandList>
          <CommandEmpty>No matching assets.</CommandEmpty>
          {groups.map(([label, items]) => (
            <CommandGroup key={label} heading={label}>
              {items.map((i) => (
                <CommandItem
                  key={i.symbol}
                  value={`${i.symbol} ${displaySymbol(i.symbol)} ${i.name}`}
                  onSelect={() => go(i.symbol)}
                >
                  <span className="font-mono text-xs font-semibold">{displaySymbol(i.symbol)}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{i.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
