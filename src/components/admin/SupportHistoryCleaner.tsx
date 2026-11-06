import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Eraser, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { clearSupportHistory } from "@/lib/admin-maintenance.functions";
import { adminSearch } from "@/lib/admin-search.functions";

const CATEGORIES = [
  { key: "live_chat", label: "Live chat messages" },
  { key: "priority_support", label: "Priority support messages & requests" },
  { key: "tickets", label: "Support tickets & submitted requests" },
] as const;
const AUDIENCES = [
  { key: "both", label: "Both sides (permanent delete)", hint: "Removed for staff and the customer. Cannot be undone." },
  { key: "staff", label: "Operations Console only", hint: "Hidden from staff; customers still see their history." },
  { key: "customer", label: "Customer side only", hint: "Hidden from customers; staff keep the record." },
] as const;

type Cat = (typeof CATEGORIES)[number]["key"];
type Aud = (typeof AUDIENCES)[number]["key"];

export function SupportHistoryCleaner() {
  const qc = useQueryClient();
  const clear = useServerFn(clearSupportHistory);
  const search = useServerFn(adminSearch);
  const [open, setOpen] = useState(false);
  const [cats, setCats] = useState<Cat[]>(["live_chat", "priority_support", "tickets"]);
  const [audience, setAudience] = useState<Aud>("both");
  const [target, setTarget] = useState<"all" | "user">("all");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; title: string; subtitle: string }[]>([]);
  const [user, setUser] = useState<{ id: string; title: string } | null>(null);
  const [confirm, setConfirm] = useState("");

  const find = useMutation({
    mutationFn: () => search({ data: { q } }),
    onSuccess: (r: any[]) => setHits(r.filter((h) => h.kind === "user").map((h) => ({ id: h.userId ?? h.id, title: h.title, subtitle: h.subtitle }))),
    onError: () => toast.error("Search failed."),
  });

  const run = useMutation({
    mutationFn: () =>
      clear({ data: { categories: cats, audience, userId: target === "user" ? user!.id : null, confirm: "CLEAR" } }),
    onSuccess: (r) => {
      const total = Object.values(r.affected).reduce((a, b) => a + b, 0);
      toast.success(`Support history cleared (${total} records).`);
      qc.invalidateQueries();
      setOpen(false);
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ready = cats.length > 0 && confirm === "CLEAR" && (target === "all" || !!user);
  const opt = (active: boolean) =>
    `w-full rounded-md border px-3 py-2 text-left text-xs transition ${active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-bear">
          <Eraser className="h-4 w-4" /> Clear support history
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Clear support history</DialogTitle>
          <DialogDescription>Choose what to clear, where it disappears, and for whom.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">What</p>
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={cats.includes(c.key)}
                  onCheckedChange={(v) => setCats((p) => (v ? [...p, c.key] : p.filter((x) => x !== c.key)))}
                />
                {c.label}
              </label>
            ))}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Where</p>
            {AUDIENCES.map((a) => (
              <button key={a.key} type="button" className={opt(audience === a.key)} onClick={() => setAudience(a.key)}>
                <span className="font-medium">{a.label}</span>
                <span className="block text-muted-foreground">{a.hint}</span>
              </button>
            ))}
          </section>

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">Who</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={opt(target === "all")} onClick={() => setTarget("all")}>All users</button>
              <button type="button" className={opt(target === "user")} onClick={() => setTarget("user")}>Individual user</button>
            </div>
            {target === "user" && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, UID or name" className="h-8 text-xs" />
                  <Button size="sm" variant="outline" disabled={q.trim().length < 2 || find.isPending} onClick={() => find.mutate()}>
                    <Search className="h-4 w-4" />
                  </Button>
                </div>
                {user && <p className="text-xs">Selected: <span className="font-medium">{user.title}</span></p>}
                {hits.map((h) => (
                  <button key={h.id} type="button" className={opt(user?.id === h.id)} onClick={() => setUser({ id: h.id, title: h.title })}>
                    <span className="font-medium">{h.title}</span>
                    <span className="block text-muted-foreground">{h.subtitle}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-1">
            <p className="text-xs text-muted-foreground">Type CLEAR to confirm</p>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-8 text-xs" />
          </section>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={!ready || run.isPending} onClick={() => run.mutate()}>
            {run.isPending ? "Clearing..." : "Clear history"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
