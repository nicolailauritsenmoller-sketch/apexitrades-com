import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, CheckCheck, Loader2, Lock, LockOpen, Paperclip, Send, UserCog, X } from "lucide-react";
import { VipAttachment, formatBytes } from "@/components/chat/VipAttachment";
import { supabase } from "@/integrations/supabase/client";
import { UidTag } from "@/components/VerifiedBadge";
import { VIP_ROLES } from "@/lib/vip";
import {
  getVipDesk,
  getVipDeskThread,
  saveVipSpecialist,
  sendVipDeskMessage,
  setVipAccess,
} from "@/lib/vip.functions";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Admin VIP portal: specialist personas, unlock switches, and specialist inboxes. */
export function VipDesk() {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getVipDesk);
  const fetchThread = useServerFn(getVipDeskThread);
  const send = useServerFn(sendVipDeskMessage);
  const saveSpecialist = useServerFn(saveVipSpecialist);
  const setAccess = useServerFn(setVipAccess);

  const [active, setActive] = useState<{ userId: string; roleKey: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [grantRef, setGrantRef] = useState("");
  const [grantRole, setGrantRole] = useState<string>(VIP_ROLES[0].key);
  const endRef = useRef<HTMLDivElement>(null);

  const desk = useQuery({
    queryKey: ["vip-desk"],
    queryFn: () => fetchDesk(),
    refetchInterval: 10000,
  });

  const thread = useQuery({
    queryKey: ["vip-desk-thread", active?.userId, active?.roleKey],
    queryFn: () =>
      fetchThread({ data: { userId: active!.userId, roleKey: active!.roleKey as any } }),
    enabled: !!active,
    refetchInterval: 5000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data]);

  // Realtime unread sync across specialist inboxes.
  useEffect(() => {
    const channel = supabase
      .channel("vip-messages-desk")
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["vip-desk"] });
        qc.invalidateQueries({ queryKey: ["vip-desk-thread"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);

  const specialists = desk.data?.specialists ?? [];
  const threads = desk.data?.threads ?? [];

  const activeSpecialist = useMemo(
    () => specialists.find((s: any) => s.roleKey === active?.roleKey),
    [specialists, active],
  );
  const activeThread = useMemo(
    () => threads.find((t: any) => t.userId === active?.userId && t.roleKey === active?.roleKey),
    [threads, active],
  );

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      let attach: Record<string, unknown> = {};
      if (file) {
        const path = `vip-staff/${active!.userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
        if (error) throw new Error(error.message);
        attach = {
          attachmentPath: path,
          attachmentName: file.name,
          attachmentType: file.type,
          attachmentSize: file.size,
        };
      }
      return send({
        data: { userId: active!.userId, roleKey: active!.roleKey as any, body, ...attach } as any,
      });
    },
    onSuccess: () => {
      setDraft("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["vip-desk-thread", active?.userId, active?.roleKey] });
      qc.invalidateQueries({ queryKey: ["vip-desk"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMutation = useMutation({
    mutationFn: (v: any) => saveSpecialist({ data: v }),
    onSuccess: () => {
      toast.success("Specialist profile saved.");
      qc.invalidateQueries({ queryKey: ["vip-desk"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const accessMutation = useMutation({
    mutationFn: (v: { userRef: string; roleKey: string; unlocked: boolean }) =>
      setAccess({ data: { ...v, roleKey: v.roleKey as any } }),
    onSuccess: (_r, v) => {
      toast.success(v.unlocked ? "Specialist unlocked for user." : "Specialist locked.");
      qc.invalidateQueries({ queryKey: ["vip-desk"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {/* Unlock control */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <LockOpen className="size-4 text-emerald-500" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Unlock specialist access
          </h2>
        </header>
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">User UID or account ID</span>
            <input
              value={grantRef}
              onChange={(e) => setGrantRef(e.target.value)}
              placeholder="#A1B2C3D"
              className="w-52 rounded-md bg-secondary px-3 py-2 font-mono text-sm font-bold outline-none"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-muted-foreground">Specialist</span>
            <select
              value={grantRole}
              onChange={(e) => setGrantRole(e.target.value)}
              className="rounded-md bg-secondary px-3 py-2 text-sm outline-none"
            >
              {VIP_ROLES.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() =>
              accessMutation.mutate({ userRef: grantRef.trim(), roleKey: grantRole, unlocked: true })
            }
            disabled={accessMutation.isPending || grantRef.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {accessMutation.isPending && <Loader2 className="size-4 animate-spin" />} Unlock
          </button>
          <button
            onClick={() =>
              accessMutation.mutate({
                userRef: grantRef.trim(),
                roleKey: grantRole,
                unlocked: false,
              })
            }
            disabled={accessMutation.isPending || grantRef.trim().length < 3}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            Lock
          </button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* Threads */}
        <section className="rounded-lg border border-border bg-card">
          <header className="border-b border-border px-4 py-3 text-sm font-semibold">
            Specialist inboxes
          </header>
          <div className="max-h-[520px] divide-y divide-border overflow-y-auto">
            {threads.length === 0 && (
              <p className="p-6 text-center text-xs text-muted-foreground">No VIP threads yet.</p>
            )}
            {threads.map((t: any) => {
              const label = VIP_ROLES.find((r) => r.key === t.roleKey)?.label ?? t.roleKey;
              const selected = active?.userId === t.userId && active?.roleKey === t.roleKey;
              return (
                <button
                  key={`${t.userId}-${t.roleKey}`}
                  onClick={() => setActive({ userId: t.userId, roleKey: t.roleKey })}
                  className={`block w-full px-4 py-3 text-left ${selected ? "bg-secondary" : "hover:bg-secondary/60"}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{t.userName}</span>
                    <UidTag uid={t.userUid} className="text-muted-foreground" />
                    {t.unlocked ? (
                      <LockOpen className="size-3 text-emerald-500" />
                    ) : (
                      <Lock className="size-3 text-muted-foreground" />
                    )}
                    {t.unread > 0 && (
                      <span className="ml-auto grid size-5 place-items-center rounded-full bg-red-600 text-[10px] font-bold text-white">
                        {t.unread}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-primary">{label}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.lastBody ?? "—"}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Conversation */}
        <section className="flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-card">
          {!active ? (
            <p className="m-auto text-sm text-muted-foreground">
              Select a thread to reply as the specialist.
            </p>
          ) : (
            <>
              <header className="flex items-center gap-2 bg-emerald-700 px-4 py-3 text-white">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {activeSpecialist?.fullName} · {activeSpecialist?.roleLabel}
                  </p>
                  <p className="truncate text-[11px] text-emerald-100">
                    with {activeThread?.userName} ·{" "}
                    <span className="font-bold">#{activeThread?.userUid}</span>
                  </p>
                </div>
                <button
                  onClick={() =>
                    accessMutation.mutate({
                      userRef: active.userId,
                      roleKey: active.roleKey,
                      unlocked: !activeThread?.unlocked,
                    })
                  }
                  className="ml-auto rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
                >
                  {activeThread?.unlocked ? "Lock thread" : "Unlock thread"}
                </button>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b141a] px-3 py-4">
                {(thread.data ?? []).map((m: any) => {
                  const staff = m.senderRole !== "user";
                  return (
                    <div key={m.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm text-white shadow ${
                          staff ? "bg-emerald-800" : "bg-[#202c33]"
                        }`}
                      >
                        {m.attachmentPath && (
                          <VipAttachment
                            messageId={m.id}
                            name={m.attachmentName}
                            type={m.attachmentType}
                            size={m.attachmentSize}
                          />
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/70">
                          {time(m.createdAt)}
                          {staff &&
                            (m.readAt ? (
                              <CheckCheck className="size-3 text-sky-400" />
                            ) : (
                              <Check className="size-3" />
                            ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim() || file) sendMutation.mutate(draft.trim());
                }}
                className="flex flex-col gap-2 bg-[#202c33] px-3 py-2"
              >
                {file && (
                  <div className="flex items-center gap-2 rounded-md bg-black/30 px-2 py-1 text-[11px] text-white/90">
                    <Paperclip className="size-3" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="opacity-70">{formatBytes(file.size)}</span>
                    <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment">
                      <X className="size-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-9 place-items-center rounded-full text-white/70 hover:text-white"
                  aria-label="Attach a file"
                >
                  <Paperclip className="size-5" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={`Reply as ${activeSpecialist?.fullName ?? "specialist"}`}
                  className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm text-white outline-none placeholder:text-white/60"
                />
                <button
                  type="submit"
                  disabled={(!draft.trim() && !file) || sendMutation.isPending}
                  className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-50"
                  aria-label="Send"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>

      {/* Persona editor */}
      <section className="rounded-lg border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <UserCog className="size-4 text-primary" />
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Specialist profiles
          </h2>
        </header>
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {specialists.map((s: any) => {
            const e = edits[s.roleKey] ?? s;
            const set = (patch: any) =>
              setEdits((prev) => ({ ...prev, [s.roleKey]: { ...e, ...patch } }));
            return (
              <div key={s.roleKey} className="space-y-2 rounded-md border border-border p-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                  {s.roleLabel}
                </p>
                <input
                  value={e.fullName}
                  onChange={(ev) => set({ fullName: ev.target.value })}
                  placeholder="Name"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
                />
                <input
                  value={e.title}
                  onChange={(ev) => set({ title: ev.target.value })}
                  placeholder="Title"
                  className="w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={e.staffId}
                    onChange={(ev) => set({ staffId: ev.target.value })}
                    placeholder="Staff ID"
                    className="w-32 rounded-md bg-secondary px-3 py-2 font-mono text-sm font-bold outline-none"
                  />
                  <input
                    value={e.avatarUrl ?? ""}
                    onChange={(ev) => set({ avatarUrl: ev.target.value })}
                    placeholder="Avatar URL (optional)"
                    className="flex-1 rounded-md bg-secondary px-3 py-2 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={() =>
                    saveMutation.mutate({
                      roleKey: s.roleKey,
                      fullName: e.fullName,
                      title: e.title,
                      staffId: e.staffId,
                      avatarUrl: e.avatarUrl?.trim() ? e.avatarUrl.trim() : null,
                    })
                  }
                  disabled={saveMutation.isPending}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Save profile
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
