import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listSessions, removeSession, signOutEverywhere } from "@/lib/sessions";

export function DevicesPanel() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: listSessions });

  const removeDevice = useMutation({
    mutationFn: removeSession,
    onSuccess: () => {
      toast.success("Device removed");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logoutAll = useMutation({
    mutationFn: signOutEverywhere,
    onSuccess: () => {
      window.location.href = "/auth";
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="py-2 pr-3">Device</th>
              <th className="py-2 pr-3">IP</th>
              <th className="py-2 pr-3">Country</th>
              <th className="py-2 pr-3">Last active</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {(sessions.data ?? []).map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-2 pr-3">
                  {s.browser} on {s.os}
                  {s.isCurrent && (
                    <span className="ml-2 rounded-full border border-bull/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-bull">
                      This device
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{s.ip ?? "—"}</td>
                <td className="py-2 pr-3">{s.country ?? "—"}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">
                  {new Date(s.lastActiveAt).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  <button
                    onClick={() => removeDevice.mutate(s.id)}
                    disabled={s.isCurrent}
                    className="inline-flex touch-manipulation items-center gap-1 rounded-md border border-border px-2 py-1 text-xs disabled:opacity-40"
                  >
                    <Trash2 className="size-3" /> Remove
                  </button>
                </td>
              </tr>
            ))}
            {(sessions.data ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                  No devices recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => logoutAll.mutate()}
        className="mt-4 inline-flex touch-manipulation items-center gap-2 rounded-md border border-bear/40 px-3 py-2 text-sm text-bear"
      >
        <LogOut className="size-4" /> Log out all devices
      </button>
    </>
  );
}
