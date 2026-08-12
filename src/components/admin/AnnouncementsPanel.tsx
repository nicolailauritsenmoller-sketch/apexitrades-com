import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Megaphone, Pencil, Trash2 } from "lucide-react";
import {
  deleteAnnouncement,
  listAnnouncements,
  upsertAnnouncement,
  type Announcement,
  type AnnouncementSeverity,
} from "@/lib/announcements.functions";
import { getUserDirectory } from "@/lib/admin.functions";

const SEVERITIES: { id: AnnouncementSeverity; label: string; className: string }[] = [
  { id: "info", label: "Info", className: "bg-primary/15 text-primary" },
  { id: "warning", label: "Warning", className: "bg-amber-500/15 text-amber-500" },
  { id: "critical", label: "Critical", className: "bg-bear/15 text-bear" },
];

const empty = {
  id: undefined as string | undefined,
  title: "",
  body: "",
  severity: "info" as AnnouncementSeverity,
  active: true,
  targetUserId: null as string | null,
};

export function AnnouncementsPanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(listAnnouncements);
  const save = useServerFn(upsertAnnouncement);
  const remove = useServerFn(deleteAnnouncement);
  const [draft, setDraft] = useState(empty);
  const [userQuery, setUserQuery] = useState("");
  const fetchUsers = useServerFn(getUserDirectory);
  const directory = useQuery({ queryKey: ["admin-directory"], queryFn: () => fetchUsers() });
  const users = (directory.data ?? []) as any[];
  const q = userQuery.trim().toLowerCase();
  const matches = q
    ? users.filter(
        (u) =>
          String(u.uid ?? "").toLowerCase().includes(q) ||
          String(u.displayName ?? "").toLowerCase().includes(q) ||
          String(u.legalName ?? "").toLowerCase().includes(q) ||
          String(u.id).toLowerCase().includes(q),
      )
    : users;
  const targetUser = users.find((u) => u.id === draft.targetUserId);

  const rows = useQuery({ queryKey: ["admin-announcements"], queryFn: () => fetchAll() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements-active"] });
  };

  const saveMutation = useMutation({
    mutationFn: (input: any) => save({ data: input }),
    onSuccess: () => {
      toast.success("Announcement published.");
      setDraft(empty);
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Announcement deleted.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = (rows.data ?? []) as Announcement[];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-xl">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Megaphone className="size-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Announcement banners ({list.length})
          </h2>
        </header>
        <div className="p-4">
          {rows.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : list.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No announcements yet. Publish one to alert every signed-in user.
            </p>
          ) : (
            <ul className="space-y-2">
              {list.map((a) => {
                const tone = SEVERITIES.find((s) => s.id === a.severity) ?? SEVERITIES[0]!;
                return (
                  <li
                    key={a.id}
                    className="rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone.className}`}
                      >
                        {tone.label}
                      </span>
                      <p className="text-sm font-semibold">{a.title}</p>
                      <span
                        className={`ml-auto text-[11px] uppercase ${a.active ? "text-bull" : "text-muted-foreground"}`}
                      >
                        {a.active ? "live" : "archived"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{a.body}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Audience:{" "}
                      <span className="font-semibold text-foreground">
                        {a.targetUserId ? "Specific user" : "All users"}
                      </span>
                      {a.targetUserId ? (
                        <span className="font-mono"> · {a.targetUserId.slice(0, 8)}…</span>
                      ) : null}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          setDraft({
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            severity: a.severity,
                            active: a.active,
                            targetUserId: a.targetUserId ?? null,
                          })
                        }
                        className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="size-3" /> Edit
                      </button>
                      <button
                        onClick={() =>
                          saveMutation.mutate({
                            id: a.id,
                            title: a.title,
                            body: a.body,
                            severity: a.severity,
                            active: !a.active,
                            targetUserId: a.targetUserId ?? null,
                          })
                        }
                        className="rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {a.active ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(a.id)}
                        className="flex items-center gap-1.5 rounded-md bg-bear/10 px-2.5 py-1 text-[11px] font-semibold text-bear"
                      >
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card/80 shadow-sm backdrop-blur-xl">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            {draft.id ? "Edit announcement" : "New announcement"}
          </h2>
        </header>
        <div className="space-y-3 p-4">
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Title"
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
          <textarea
            value={draft.body}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            rows={4}
            placeholder="Message shown in the banner"
            className="w-full rounded-md border border-border bg-background p-2 text-sm"
          />
          <div className="space-y-2 rounded-md border border-border p-2.5">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              Target audience
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setDraft((d) => ({ ...d, targetUserId: null }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                  draft.targetUserId === null
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                All users
              </button>
              <button
                onClick={() =>
                  setDraft((d) => ({ ...d, targetUserId: d.targetUserId ?? (users[0]?.id ?? null) }))
                }
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${
                  draft.targetUserId !== null
                    ? "bg-primary/15 text-primary"
                    : "border border-border text-muted-foreground"
                }`}
              >
                Specific user
              </button>
            </div>
            {draft.targetUserId !== null && (
              <>
                <input
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by UID, name or account id"
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                />
                <select
                  value={draft.targetUserId ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, targetUserId: e.target.value || null }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                >
                  <option value="">Select a user…</option>
                  {matches.slice(0, 100).map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} — #{u.uid ?? String(u.id).slice(0, 8)}
                    </option>
                  ))}
                </select>
                {targetUser && (
                  <p className="text-[11px] text-muted-foreground">
                    Only <span className="font-semibold text-foreground">{targetUser.displayName}</span>{" "}
                    will see this banner.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="flex gap-1">
            {SEVERITIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setDraft((d) => ({ ...d, severity: s.id }))}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                  draft.severity === s.id
                    ? s.className
                    : "border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))}
            />
            Publish immediately
          </label>
          <div className="flex gap-2">
            <button
              disabled={
                saveMutation.isPending || draft.title.trim().length < 2 || draft.body.trim().length < 2
              }
              onClick={() =>
                saveMutation.mutate({
                  ...(draft.id ? { id: draft.id } : {}),
                  title: draft.title.trim(),
                  body: draft.body.trim(),
                  severity: draft.severity,
                  active: draft.active,
                  targetUserId: draft.targetUserId,
                })
              }
              className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {draft.id ? "Save changes" : "Publish banner"}
            </button>
            {draft.id && (
              <button
                onClick={() => setDraft(empty)}
                className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Critical banners stay pinned for users — they cannot be dismissed until you unpublish
            them.
          </p>
        </div>
      </section>
    </div>
  );
}
