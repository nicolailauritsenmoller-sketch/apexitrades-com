import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveUsers } from "@/lib/desk.functions";

/** Live list of users currently connected, with device, network and page. */
export function ActiveUsersPanel({ compact = false }: { compact?: boolean }) {
  const qc = useQueryClient();
  const fetchActive = useServerFn(getActiveUsers);
  const q = useQuery({
    queryKey: ["active-users"],
    queryFn: () => fetchActive(),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("desk-active-users")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_sessions" }, () =>
        qc.invalidateQueries({ queryKey: ["active-users"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const rows = q.data?.rows ?? [];

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className="grid size-9 place-items-center rounded-md bg-bull/15 text-bull">
          <Radio className="size-4" />
        </span>
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Active users now
          </p>
          <p className="font-display text-xl font-bold">{q.data?.count ?? 0}</p>
        </div>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-display text-sm font-semibold tracking-tight">
          <span className="live-dot size-2 rounded-full bg-bull" />
          Active users now
        </h2>
        <span className="text-xs text-muted-foreground">
          {q.data?.count ?? 0} online · {rows.length} sessions
        </span>
      </header>
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Nobody online right now.</p>
        ) : (
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Viewing</th>
                <th className="px-4 py-2">IP</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">Device</th>
                <th className="px-4 py-2">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="px-4 py-2">
                    <span className="font-medium">{r.name}</span>
                    <span className="block text-[11px] text-muted-foreground">UID {r.uid}</span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.path ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.ip ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">{r.country ?? "—"}</td>
                  <td className="px-4 py-2 text-xs">
                    {r.browser} · {r.os}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-[11px] text-muted-foreground">
                    {new Date(r.lastActiveAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
