import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { KeyRound, LogOut, NotebookPen, Snowflake, Trash2, WalletMinimal } from "lucide-react";
import {
  addUserNote,
  deleteUserNote,
  forcePasswordReset,
  getUserNotes,
  setUserAccountControls,
  terminateUserSessions,
} from "@/lib/admin-ops.functions";

function Toggle({
  label,
  icon: Icon,
  active,
  onClick,
  pending,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      disabled={pending}
      onClick={onClick}
      className={`flex touch-manipulation items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
        active
          ? "border-l-4 border-ops-red/50 border-l-ops-red bg-ops-red/15 text-ops-red"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-3.5" />
      {label}
      <span
        className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none ${
          active ? "bg-ops-red/20 text-ops-red" : "text-muted-foreground"
        }`}
      >
        {active ? "Restricted" : "Off"}
      </span>
    </button>
  );
}

/** Compliance quick actions + internal admin note log for a single account. */
export function UserAccountControls({
  userId,
  tradingFrozen,
  withdrawalsDisabled,
  onChanged,
}: {
  userId: string;
  tradingFrozen: boolean;
  withdrawalsDisabled: boolean;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const setControls = useServerFn(setUserAccountControls);
  const terminate = useServerFn(terminateUserSessions);
  const resetPw = useServerFn(forcePasswordReset);
  const fetchNotes = useServerFn(getUserNotes);
  const createNote = useServerFn(addUserNote);
  const removeNote = useServerFn(deleteUserNote);
  const [note, setNote] = useState("");

  const notes = useQuery({
    queryKey: ["admin-user-notes", userId],
    queryFn: () => fetchNotes({ data: { userId } }),
  });

  const controls = useMutation({
    mutationFn: (patch: { tradingFrozen?: boolean; withdrawalsDisabled?: boolean }) =>
      setControls({ data: { userId, ...patch } }),
    onSuccess: () => {
      toast.success("Account controls updated.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sessions = useMutation({
    mutationFn: () => terminate({ data: { userId } }),
    onSuccess: (r: any) =>
      toast.success(r?.revoked ? "All sessions terminated." : "Device records cleared."),
    onError: (e: Error) => toast.error(e.message),
  });

  const password = useMutation({
    mutationFn: () => resetPw({ data: { userId } }),
    onSuccess: () => toast.success("Password reset issued — the user was notified by email."),
    onError: (e: Error) => toast.error(e.message),
  });

  const add = useMutation({
    mutationFn: () => createNote({ data: { userId, body: note.trim() } }),
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["admin-user-notes", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => removeNote({ data: { id } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-user-notes", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Toggle
          label="Freeze account trading"
          icon={Snowflake}
          active={tradingFrozen}
          pending={controls.isPending}
          onClick={() => controls.mutate({ tradingFrozen: !tradingFrozen })}
        />
        <Toggle
          label="Disable withdrawals"
          icon={WalletMinimal}
          active={withdrawalsDisabled}
          pending={controls.isPending}
          onClick={() => controls.mutate({ withdrawalsDisabled: !withdrawalsDisabled })}
        />
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => password.mutate()}
            disabled={password.isPending}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <KeyRound className="size-3.5" /> Force reset
          </button>
          <button
            onClick={() => sessions.mutate()}
            disabled={sessions.isPending}
            className="flex touch-manipulation items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            <LogOut className="size-3.5" /> End sessions
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <NotebookPen className="size-3" /> Admin notes
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="e.g. Account flagged for suspicious IP logins"
          className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-ring"
        />
        <button
          onClick={() => add.mutate()}
          disabled={!note.trim() || add.isPending}
          className="mt-1.5 w-full touch-manipulation rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {add.isPending ? "Saving…" : "Add note"}
        </button>

        <ul className="mt-2 space-y-1.5">
          {(notes.data as any[] | undefined)?.map((x) => (
            <li key={x.id} className="rounded-lg border border-border/60 p-2 text-xs">
              <p className="whitespace-pre-wrap">{x.body}</p>
              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span>
                  {x.author_name ?? "Staff"} · {new Date(x.created_at).toLocaleString()}
                </span>
                <button
                  onClick={() => del.mutate(x.id)}
                  className="ml-auto touch-manipulation text-bear"
                  aria-label="Delete note"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </li>
          ))}
          {notes.data && (notes.data as any[]).length === 0 && (
            <p className="text-[11px] text-muted-foreground">No internal notes yet.</p>
          )}
        </ul>
      </div>
    </div>
  );
}
