import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { adminSearch, type AdminSearchHit } from "@/lib/admin-search.functions";
import { UserWorkspaceDrawer } from "@/components/admin/UserWorkspaceDrawer";

const GROUPS: { kind: AdminSearchHit["kind"]; label: string; tab: string }[] = [
  { kind: "user", label: "Users", tab: "users" },
  { kind: "deposit", label: "Deposits", tab: "deposits" },
  { kind: "withdrawal", label: "Withdrawals", tab: "withdrawals" },
  { kind: "transaction", label: "Ledger entries", tab: "transactions" },
  { kind: "ticket", label: "Support tickets", tab: "support" },
];

/** Operations Console command palette (Ctrl/Cmd + K). */
export function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [inspect, setInspect] = useState<string | null>(null);
  const navigate = useNavigate();
  const search = useServerFn(adminSearch);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { const t = setTimeout(() => setTerm(q.trim()), 250); return () => clearTimeout(t); }, [q]);

  const hits = useQuery({
    queryKey: ["admin-search", term],
    queryFn: () => search({ data: { q: term } }),
    enabled: open && term.length >= 2,
    staleTime: 10_000,
  });

  const go = (h: AdminSearchHit, tab: string) => {
    setOpen(false);
    if (h.kind === "user") { setInspect(h.id); return; }
    void navigate({ to: "/admin", search: { tab } });
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Search the console"
        className="flex touch-manipulation items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground sm:w-64">
        <Search className="size-4" />
        <span className="hidden sm:inline">Search UID, email, TXID, ticket</span>
        <kbd className="ml-auto hidden rounded border border-border px-1 font-mono text-[10px] lg:inline">Ctrl K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput value={q} onValueChange={setQ} placeholder="Search by UID, email, transaction hash or ticket ID..." />
        <CommandList>
          <CommandEmpty>{term.length < 2 ? "Type at least 2 characters." : hits.isFetching ? "Searching..." : "No matching records."}</CommandEmpty>
          {GROUPS.map((g) => {
            const items = (hits.data ?? []).filter((h) => h.kind === g.kind);
            if (!items.length) return null;
            return (
              <CommandGroup key={g.kind} heading={g.label}>
                {items.map((h) => (
                  <CommandItem key={`${h.kind}-${h.id}`} value={`${h.kind} ${h.id} ${h.title} ${h.subtitle} ${term}`} onSelect={() => go(h, g.tab)}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{h.title}</p>
                      <p className="truncate font-mono text-[10px] text-muted-foreground">{h.subtitle}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
      {inspect && <UserWorkspaceDrawer userId={inspect} onClose={() => setInspect(null)} />}
    </>
  );
}
