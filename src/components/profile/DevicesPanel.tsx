import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, LogOut, MonitorSmartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { listSessions, removeSession, signOutOtherDevices } from "@/lib/sessions";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 5;

export function DevicesPanel() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: listSessions });
  const [page, setPage] = useState(1);

  const removeDevice = useMutation({
    mutationFn: removeSession,
    onSuccess: () => {
      toast.success("Device removed");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logoutOthers = useMutation({
    mutationFn: signOutOtherDevices,
    onSuccess: () => {
      queryClient.setQueryData(["sessions"], (old: typeof sessions.data) =>
        (old ?? []).filter((row) => row.isCurrent),
      );
      toast.success("All other sessions have been logged out");
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = sessions.data ?? [];
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const visibleRows = useMemo(
    () => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, rows],
  );
  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold">Active devices</p>
          <p className="text-xs text-muted-foreground">{rows.length} recorded {rows.length === 1 ? "session" : "sessions"}</p>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => logoutOthers.mutate()}
          disabled={logoutOthers.isPending || rows.filter((row) => !row.isCurrent).length === 0}
          className="h-10"
        >
          <LogOut className="size-4" /> {logoutOthers.isPending ? "Logging out..." : "Log out all other sessions"}
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[720px] w-full text-left text-sm">
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
            {visibleRows.map((s) => (
              <tr key={s.id} className="border-t border-border transition-colors hover:bg-secondary/40">
                <td className="py-3 pr-3">
                  <span className="flex items-center gap-2 font-medium"><MonitorSmartphone className="size-4 text-muted-foreground" /> {s.browser} on {s.os}</span>
                  {s.isCurrent && (
                    <span className="ml-6 mt-1 inline-flex rounded-full border border-bull/60 bg-bull/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-bull">
                      This device
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 font-mono text-xs">{s.ip ?? "-"}</td>
                <td className="py-2 pr-3">{s.country ?? "-"}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">
                  {new Date(s.lastActiveAt).toLocaleString()}
                </td>
                <td className="py-2 text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeDevice.mutate(s.id)}
                    disabled={s.isCurrent}
                    className="h-8 text-xs text-muted-foreground"
                  >
                    <Trash2 className="size-3" /> Remove
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-4 text-sm text-muted-foreground">
                  No devices recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pageCount > 1 ? (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">Page {page} of {pageCount}</p>
          <div className="flex gap-2">
            <Button type="button" size="icon" variant="outline" aria-label="Previous devices page" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft /></Button>
            <Button type="button" size="icon" variant="outline" aria-label="Next devices page" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight /></Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
