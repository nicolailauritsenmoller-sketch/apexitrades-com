import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, CheckCheck, Loader2, Lock, LockOpen, Paperclip, Send, Upload, UserCog, X } from "lucide-react";
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
  setSpecialistAvailability,
  updateVipThread,
  uploadSpecialistAvatar,
} from "@/lib/vip.functions";

const SLA_MINUTES = 15;
const CANNED = [
  "Thank you for reaching out. I am reviewing your account now and will reply shortly.",
  "Could you please share the transaction ID (TXID) and the network used?",
  "Your request has been escalated to our compliance team. Expected turnaround is within 24 hours.",
  "For your security, please confirm the last 4 characters of your registered email address.",
  "The matter has been resolved. Please let me know if there is anything else I can help with.",
];
const AVAIL = {
  available: { label: "Available", cls: "bg-bull/15 text-bull", dot: "bg-bull" },
  busy: { label: "In call / Busy", cls: "bg-amber-400/15 text-amber-500", dot: "bg-amber-400" },
  offline: { label: "Offline", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
} as const;

function slaBadge(waitingSince: string | null, now: number) {
  if (!waitingSince) return null;
  const left = SLA_MINUTES * 60_000 - (now - new Date(waitingSince).getTime());
  const m = Math.ceil(Math.abs(left) / 60_000);
  if (left <= 0) return { text: `SLA breached - ${m}m overdue`, cls: "bg-destructive/15 text-destructive" };
  if (left < 5 * 60_000) return { text: `Urgent - ${m}m left to reply`, cls: "bg-destructive/15 text-destructive" };
  return { text: `${m}m left to reply`, cls: "bg-amber-400/15 text-amber-500" };
}

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
  const [filter, setFilter] = useState<"all" | "unassigned" | "active" | "resolved">("all");
  const [search, setSearch] = useState("");
  const [internal, setInternal] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  const threadFn = useServerFn(updateVipThread);
  const availFn = useServerFn(setSpecialistAvailability);
  const avatarFn = useServerFn(uploadSpecialistAvatar);

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
  const allThreads = desk.data?.threads ?? [];
  const counts = {
    all: allThreads.length,
    unassigned: allThreads.filter((t: any) => t.status !== "resolved" && !t.assignedTo).length,
    active: allThreads.filter((t: any) => t.status !== "resolved" && t.assignedTo).length,
    resolved: allThreads.filter((t: any) => t.status === "resolved").length,
  };
  const threads = allThreads.filter((t: any) => {
    if (filter === "unassigned" && (t.status === "resolved" || t.assignedTo)) return false;
    if (filter === "active" && (t.status === "resolved" || !t.assignedTo)) return false;
    if (filter === "resolved" && t.status !== "resolved") return false;
    const q = search.trim().toLowerCase().replace(/^#/, "");
    if (!q) return true;
    const label = VIP_ROLES.find((r) => r.key === t.roleKey)?.label ?? t.roleKey;
    return [t.userUid, t.userName, label].some((v) => String(v ?? "").toLowerCase().includes(q));
  });
  const messages = (thread.data as any)?.messages ?? [];
  const auditRows = (thread.data as any)?.audit ?? [];

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
      if (internal && file) throw new Error("Attachments cannot be added to internal notes.");
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
        data: { userId: active!.userId, roleKey: active!.roleKey as any, body, internal, ...attach } as any,
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

  const workflow = useMutation({
    mutationFn: (v: { action: "assign" | "unassign" | "resolve" | "reopen" | "transfer"; toRole?: string }) =>
      threadFn({ data: { userId: active!.userId, roleKey: active!.roleKey as any, action: v.action, toRole: v.toRole as any } }),
    onSuccess: (r, v) => {
      toast.success({ assign: "Thread assigned to you", unassign: "Thread unassigned", resolve: "Thread resolved", reopen: "Thread reopened", transfer: "Thread transferred" }[v.action]);
      if (v.action === "transfer") setActive({ userId: active!.userId, roleKey: r.roleKey });
      qc.invalidateQueries({ queryKey: ["vip-desk"] });
      qc.invalidateQueries({ queryKey: ["vip-desk-thread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const availMutation = useMutation({
    mutationFn: (v: { roleKey: string; availability: "available" | "busy" | "offline" }) => availFn({ data: v as any }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vip-desk"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const avatarMutation = useMutation({
    mutationFn: async ({ roleKey, f }: { roleKey: string; f: File }) => {
      if (f.size > 2_000_000) throw new Error("Image must be 2 MB or smaller.");
      const buf = new Uint8Array(await f.arrayBuffer());
      let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return avatarFn({ data: { roleKey: roleKey as any, contentType: f.type as any, base64: btoa(bin) } });
    },
    onSuccess: (r, v) => {
      toast.success("Profile picture updated.");
      setEdits((prev) => ({ ...prev, [v.roleKey]: { ...(prev[v.roleKey] ?? specialists.find((s: any) => s.roleKey === v.roleKey)), avatarUrl: r.url } }));
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
          <header className="space-y-2 border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Specialist inboxes</p>
            <div className="flex flex-wrap gap-1">
              {([["all", "All Inboxes"], ["unassigned", "Unassigned"], ["active", "Active / In Progress"], ["resolved", "Resolved / Closed"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setFilter(k)} className={`touch-manipulation rounded-full px-2.5 py-1 text-[11px] font-semibold ${filter === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {l} <span className="font-mono opacity-80">{counts[k]}</span>
                </button>
              ))}
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search UID, trader or specialist role" className="w-full rounded-md bg-secondary px-3 py-2 text-xs outline-none" />
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
                  <p className="truncate text-xs text-primary">{label}{t.assignedName ? <span className="text-muted-foreground"> · {t.assignedName}</span> : null}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {t.status === "resolved" ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Resolved</span>
                    ) : (() => { const b = slaBadge(t.waitingSince, now); return b ? <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${b.cls}`}>{b.text}</span> : null; })()}
                    {t.status !== "resolved" && !t.assignedTo && <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">Unassigned</span>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{t.lastBody ?? "-"}</p>
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
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  {activeThread?.assignedTo ? (
                    <button onClick={() => workflow.mutate({ action: "unassign" })} disabled={workflow.isPending} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Unassign</button>
                  ) : (
                    <button onClick={() => workflow.mutate({ action: "assign" })} disabled={workflow.isPending} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">Assign to me</button>
                  )}
                  <button onClick={() => workflow.mutate({ action: activeThread?.status === "resolved" ? "reopen" : "resolve" })} disabled={workflow.isPending} className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                    {activeThread?.status === "resolved" ? "Reopen" : "Resolve"}
                  </button>
                  <select
                    value=""
                    disabled={workflow.isPending}
                    onChange={(e) => { const to = e.target.value; if (to && window.confirm(`Transfer this thread to ${VIP_ROLES.find((r) => r.key === to)?.label}?`)) workflow.mutate({ action: "transfer", toRole: to }); }}
                    className="rounded-full bg-white/15 px-2 py-1 text-xs font-semibold text-white outline-none"
                    aria-label="Transfer specialist thread"
                  >
                    <option value="" className="text-foreground">Transfer to...</option>
                    {VIP_ROLES.filter((r) => r.key !== active.roleKey).map((r) => <option key={r.key} value={r.key} className="text-foreground">{r.label}</option>)}
                  </select>
                <button
                  onClick={() =>
                    accessMutation.mutate({
                      userRef: active.userId,
                      roleKey: active.roleKey,
                      unlocked: !activeThread?.unlocked,
                    })
                  }
                  className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold"
                >
                  {activeThread?.unlocked ? "Lock thread" : "Unlock thread"}
                </button>
                </div>
              </header>

              <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b141a] px-3 py-4">
                {messages.map((m: any) => {
                  const staff = m.senderRole !== "user";
                  if (m.internal) return (
                    <div key={m.id} className="mx-auto max-w-[85%] rounded-lg border border-dashed border-amber-400/60 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest">Internal staff note · {time(m.createdAt)}</p>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                    </div>
                  );
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
                {auditRows.length > 0 && (
                  <details className="mt-4 rounded-md border border-white/10 bg-black/30 p-2 text-[11px] text-white/80">
                    <summary className="cursor-pointer font-semibold">Audit log ({auditRows.length})</summary>
                    <ul className="mt-2 space-y-1">
                      {auditRows.map((a: any) => (
                        <li key={a.id} className="flex justify-between gap-2 font-mono"><span>{a.action} · {a.actor_name ?? "Staff"}</span><span className="text-white/50">{new Date(a.created_at).toLocaleString()}</span></li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (draft.trim() || file) sendMutation.mutate(draft.trim());
                }}
                className={`flex flex-col gap-2 px-3 py-2 ${internal ? "bg-amber-950/60" : "bg-[#202c33]"}`}
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/80">
                  <div className="inline-flex overflow-hidden rounded-full border border-white/15">
                    <button type="button" onClick={() => setInternal(false)} className={`px-3 py-1 font-semibold ${!internal ? "bg-emerald-600 text-white" : ""}`}>Reply as Specialist</button>
                    <button type="button" onClick={() => { setInternal(true); setFile(null); }} className={`px-3 py-1 font-semibold ${internal ? "bg-amber-500 text-black" : ""}`}>Internal Note (Private)</button>
                  </div>
                  <select value="" onChange={(e) => { if (e.target.value) setDraft((d) => (d ? d + " " : "") + e.target.value); }} className="rounded-full bg-black/30 px-2 py-1 text-white outline-none" aria-label="Insert canned response">
                    <option value="" className="text-foreground">Insert canned response...</option>
                    {CANNED.map((c) => <option key={c} value={c} className="text-foreground">{c.slice(0, 60)}{c.length > 60 ? "..." : ""}</option>)}
                  </select>
                </div>
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
                  disabled={internal}
                  className="grid size-9 place-items-center rounded-full text-white/70 hover:text-white"
                  aria-label="Attach a file"
                >
                  <Paperclip className="size-5" />
                </button>
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={internal ? "Private note - visible to staff only" : `Reply as ${activeSpecialist?.fullName ?? "specialist"}`}
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-widest text-primary">{s.roleLabel}</p>
                  <select
                    value={s.availability}
                    onChange={(ev) => availMutation.mutate({ roleKey: s.roleKey, availability: ev.target.value as any })}
                    className={`rounded-full px-2 py-1 text-[11px] font-semibold outline-none ${AVAIL[(s.availability as keyof typeof AVAIL) ?? "available"]?.cls ?? ""}`}
                    aria-label="Availability"
                  >
                    {Object.entries(AVAIL).map(([k, v]) => <option key={k} value={k} className="text-foreground">{v.label}</option>)}
                  </select>
                </div>
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
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
                    {avatarMutation.isPending && avatarMutation.variables?.roleKey === s.roleKey ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}Upload
                    <input type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) avatarMutation.mutate({ roleKey: s.roleKey, f }); ev.target.value = ""; }} />
                  </label>
                </div>
                <Button
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
                  className="ml-auto flex"
                >
                  {saveMutation.isPending && <Loader2 className="animate-spin" />}Save Changes
                </Button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
