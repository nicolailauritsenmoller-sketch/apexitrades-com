import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Ban, Undo2 } from "lucide-react";
import { createAccessBan, liftAccessBan, listAccessBans } from "@/lib/access-bans.functions";

type Draft = { kind: "ip" | "device"; value: string; userId: string | null; reason: string };

/** IP address and device bans with a recent-sessions picker. */
export function AccessBansPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listAccessBans);
  const create = useServerFn(createAccessBan);
  const lift = useServerFn(liftAccessBan);
  const [draft, setDraft] = useState<Draft>({ kind: "ip", value: "", userId: null, reason: "" });

  const q = useQuery({ queryKey: ["admin-access-bans"], queryFn: () => list(), refetchInterval: 20_000 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-access-bans"] });

  const add = useMutation({
    mutationFn: () => create({ data: { ...draft, value: draft.value.trim(), reason: draft.reason.trim() } }),
    onSuccess: () => {
      toast.success(draft.kind === "ip" ? "IP address banned" : "Device banned");
      setDraft({ kind: draft.kind, value: "", userId: null, reason: "" });
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const undo = useMutation({
    mutationFn: (id: string) => lift({ data: { id } }),
    onSuccess: () => {
      toast.success("Ban lifted");
      void refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bans = ((q.data?.bans ?? []) as any[]).filter((b) => b.active);
  const sessions = (q.data?.sessions ?? []) as any[];
  const isBanned = (kind: string, v: string | null) => !!v && bans.some((b) => b.kind === kind && b.value === v);

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card/50 p-4">
      <header className="flex items-center gap-2">
        <Ban className="size-4 text-ops-red" />
        <h3 className="font-display text-sm font-semibold">IP & device bans</h3>
        <span className="ml-auto text-[11px] text-muted-foreground">{bans.length} active</span>
      </header>

      <div className="grid gap-2 sm:grid-cols-[110px_1fr_1fr_auto]">
        <select
          value={draft.kind}
          onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        >
          <option value="ip">IP address</option>
          <option value="device">Device ID</option>
        </select>
        <input
          value={draft.value}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          placeholder={draft.kind === "ip" ? "203.0.113.7" : "Device ID"}
          className="num h-9 rounded-md border border-border bg-background px-2 text-sm"
        />
        <input
          value={draft.reason}
          onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
          placeholder="Reason (required, audited)"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
        />
        <button
          disabled={add.isPending || draft.value.trim().length < 3 || draft.reason.trim().length < 5}
          onClick={() => add.mutate()}
          className="h-9 touch-manipulation rounded-md bg-ops-red px-4 text-sm font-bold text-background disabled:opacity-50"
        >
          Ban
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Active bans</p>
        {bans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No active bans.</p>
        ) : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
            {bans.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                <span className="rounded bg-bear/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-ops-red">{b.kind}</span>
                <span className="num break-all">{b.value}</span>
                <span className="text-muted-foreground">- {b.reason}</span>
                <span className="num ml-auto text-muted-foreground">{new Date(b.created_at).toLocaleString()}</span>
                <button
                  onClick={() => undo.mutate(b.id)}
                  className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-2 py-1"
                >
                  <Undo2 className="size-3" /> Lift
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Recent sessions</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="px-2 py-1.5">User</th>
                <th className="px-2 py-1.5">IP / location</th>
                <th className="px-2 py-1.5">Device</th>
                <th className="px-2 py-1.5">Last active</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={`${s.user_id}-${s.device_id}`} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1.5">{s.profile?.display_name ?? "-"} <span className="num text-muted-foreground">{s.profile?.uid}</span></td>
                  <td className="num px-2 py-1.5">{s.ip_address ?? "-"} <span className="text-muted-foreground">{[s.city, s.country].filter(Boolean).join(", ")}</span></td>
                  <td className="px-2 py-1.5">{s.browser} · {s.os}</td>
                  <td className="num px-2 py-1.5 text-muted-foreground">{new Date(s.last_active_at).toLocaleString()}</td>
                  <td className="space-x-1 whitespace-nowrap px-2 py-1.5 text-right">
                    {s.ip_address && (
                      <button
                        disabled={isBanned("ip", s.ip_address)}
                        onClick={() => setDraft({ kind: "ip", value: s.ip_address, userId: s.user_id, reason: draft.reason })}
                        className="touch-manipulation rounded border border-border px-2 py-0.5 disabled:opacity-40"
                      >
                        {isBanned("ip", s.ip_address) ? "IP banned" : "Ban IP"}
                      </button>
                    )}
                    <button
                      disabled={isBanned("device", s.device_id)}
                      onClick={() => setDraft({ kind: "device", value: s.device_id, userId: s.user_id, reason: draft.reason })}
                      className="touch-manipulation rounded border border-border px-2 py-0.5 disabled:opacity-40"
                    >
                      {isBanned("device", s.device_id) ? "Device banned" : "Ban device"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Picking a session fills the form above - add a reason, then press Ban.</p>
      </div>
    </section>
  );
}
