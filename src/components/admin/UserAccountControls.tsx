import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  KeyRound,
  Lock,
  LogOut,
  NotebookPen,
  ShieldAlert,
  Snowflake,
  Trash2,
  WalletMinimal,
} from "lucide-react";
import {
  addUserNote,
  deleteUserNote,
  forcePasswordReset,
  getUserNotes,
  setAccountSuspension,
  SUSPENSION_REASONS,
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

const DURATIONS = [
  { label: "24 hours", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Custom", hours: 0 },
  { label: "Open review", hours: -1 },
] as const;

/** Compliance quick actions + internal admin note log for a single account. */
export function UserAccountControls({
  userId,
  tradingFrozen,
  withdrawalsDisabled,
  accountFrozen = false,
  suspensionStatus = "active",
  suspendedUntil = null,
  suspensionReason = null,
  onChanged,
}: {
  userId: string;
  tradingFrozen: boolean;
  withdrawalsDisabled: boolean;
  accountFrozen?: boolean;
  suspensionStatus?: string;
  suspendedUntil?: string | null;
  suspensionReason?: string | null;
  onChanged: () => void;
}) {
  const qc = useQueryClient();
  const [controlPatch, setControlPatch] = useState<{ tradingFrozen?: boolean; withdrawalsDisabled?: boolean; accountFrozen?: boolean } | null>(null);
  const setControls = useServerFn(setUserAccountControls);
  const setSuspension = useServerFn(setAccountSuspension);
  const [reason, setReason] = useState<string>(SUSPENSION_REASONS[0]);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [customUntil, setCustomUntil] = useState("");
  const [suspendNote, setSuspendNote] = useState("");
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
    mutationFn: (patch: {
      tradingFrozen?: boolean;
      withdrawalsDisabled?: boolean;
      accountFrozen?: boolean;
      reason?: string;
    }) => setControls({ data: { userId, ...patch } }),
    onSuccess: () => {
      toast.success("Account controls updated.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspend = useMutation({
    mutationFn: (input: {
      status: "active" | "suspended" | "permanently_banned";
      reason?: string;
      note?: string;
      until?: string | null;
    }) => setSuspension({ data: { userId, ...input } }),
    onSuccess: () => {
      toast.success("Account suspension state updated.");
      setSuspendNote("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function applySuspension(status: "suspended" | "permanently_banned") {
    let until: string | null = null;
    if (status === "suspended") {
      if (durationHours === 0) {
        if (!customUntil) {
          toast.error("Pick a custom end date and time.");
          return;
        }
        until = new Date(customUntil).toISOString();
      } else if (durationHours > 0) {
        until = new Date(Date.now() + durationHours * 3_600_000).toISOString();
      }
    }
    suspend.mutate({ status, reason, note: suspendNote.trim() || undefined, until });
  }

  const sessions = useMutation({
    mutationFn: () => terminate({ data: { userId } }),
    onSuccess: (r: any) =>
      toast.success(r?.revoked ? "All sessions terminated." : "Device records cleared."),
    onError: (e: Error) => toast.error(e.message),
  });

  const password = useMutation({
    mutationFn: () => resetPw({ data: { userId } }),
    onSuccess: () => toast.success("Password reset issued - the user was notified by email."),
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
      <AdminActionConfirm open={!!controlPatch} title="Confirm account restrictions" description="The selected account restriction takes effect immediately. The audit reason is retained with the account change." pending={controls.isPending} onClose={() => setControlPatch(null)} onConfirm={async (reason) => { if (controlPatch) await controls.mutateAsync({ ...controlPatch, reason }); }} />
      <div className="grid gap-2">
        <Toggle
          label="Freeze account trading"
          icon={Snowflake}
          active={tradingFrozen}
          pending={controls.isPending}
          onClick={() => setControlPatch({ tradingFrozen: !tradingFrozen })}
        />
        <Toggle
          label="Freeze withdrawals"
          icon={WalletMinimal}
          active={withdrawalsDisabled}
          pending={controls.isPending}
          onClick={() => setControlPatch({ withdrawalsDisabled: !withdrawalsDisabled })}
        />
        <Toggle
          label="Freeze entire account"
          icon={Lock}
          active={accountFrozen}
          pending={controls.isPending}
          onClick={() => setControlPatch({ accountFrozen: !accountFrozen })}
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

      <div className="rounded-lg border border-ops-red/40 bg-ops-red/5 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-ops-red">
          <ShieldAlert className="size-3" /> Suspend account
        </p>

        <p className="mb-2 text-[11px] text-muted-foreground">
          Status:{" "}
          <span className="font-semibold uppercase text-foreground">
            {suspensionStatus.replace("_", " ")}
          </span>
          {suspendedUntil ? ` · lifts ${new Date(suspendedUntil).toLocaleString()}` : ""}
          {suspensionReason ? ` · ${suspensionReason}` : ""}
        </p>

        <label className="block text-[10px] uppercase tracking-widest text-muted-foreground">
          Reason
        </label>
        <select
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-ring"
        >
          {SUSPENSION_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <label className="mt-2 block text-[10px] uppercase tracking-widest text-muted-foreground">
          Duration
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.label}
              type="button"
              onClick={() => setDurationHours(d.hours)}
              className={`touch-manipulation rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                durationHours === d.hours
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
        {durationHours === 0 && (
          <input
            type="datetime-local"
            value={customUntil}
            onChange={(e) => setCustomUntil(e.target.value)}
            className="mt-2 w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-ring"
          />
        )}

        <textarea
          value={suspendNote}
          onChange={(e) => setSuspendNote(e.target.value)}
          rows={2}
          placeholder="Optional note shown to the user"
          className="mt-2 w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-ring"
        />

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => applySuspension("suspended")}
            disabled={suspend.isPending}
            className="touch-manipulation rounded-lg bg-ops-red px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            Suspend account
          </button>
          <button
            onClick={() => applySuspension("permanently_banned")}
            disabled={suspend.isPending}
            className="touch-manipulation rounded-lg border border-ops-red/60 px-3 py-2 text-xs font-semibold text-ops-red disabled:opacity-50"
          >
            Permanent ban
          </button>
        </div>
        {suspensionStatus !== "active" && (
          <button
            onClick={() => suspend.mutate({ status: "active" })}
            disabled={suspend.isPending}
            className="mt-2 w-full touch-manipulation rounded-lg border border-ops-emerald/25 px-3 py-2 text-xs font-semibold text-ops-emerald disabled:opacity-50"
          >
            Reinstate account
          </button>
        )}
      </div>


      <div className="rounded-lg border border-border/70 p-2">
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
          <NotebookPen className="size-3" /> Internal risk notes
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
                  className="ml-auto touch-manipulation text-ops-red"
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
