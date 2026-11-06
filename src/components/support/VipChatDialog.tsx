import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, Loader2, Paperclip, Send, ShieldCheck, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VIP_DEPARTMENTS } from "@/lib/vip-queue";
import { ChatComposerInput } from "@/components/support/ChatComposerInput";
import { VipAttachment, formatBytes } from "@/components/chat/VipAttachment";
import { supabase } from "@/integrations/supabase/client";
import {
  getVipDirectory,
  getVipThread,
  requestVipAccess,
  sendVipMessage,
} from "@/lib/vip.functions";

function time(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Initials({ name, url }: { name: string; url?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url) {
    return <img src={url} alt={name} onError={() => setFailedUrl(url)} className="size-10 rounded-full object-cover" />;
  }
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ops-emerald text-sm font-bold text-primary-foreground">
      {letters}
    </span>
  );
}

/** WhatsApp-styled VIP specialist chat, locked until support unlocks a thread. */
export function VipChatDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchDirectory = useServerFn(getVipDirectory);
  const fetchThread = useServerFn(getVipThread);
  const send = useServerFn(sendVipMessage);
  const request = useServerFn(requestVipAccess);

  const directory = useQuery({
    queryKey: ["vip-directory"],
    queryFn: () => fetchDirectory(),
    enabled: open,
    refetchInterval: open ? 10000 : false,
  });

  const active = useMemo(
    () => (directory.data ?? []).find((s: any) => s.roleKey === activeRole) ?? null,
    [directory.data, activeRole],
  );

  const thread = useQuery({
    queryKey: ["vip-thread", activeRole],
    queryFn: () => fetchThread({ data: { roleKey: activeRole as any } }),
    enabled: open && !!activeRole && !!active?.connected,
    refetchInterval: 5000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data]);

  // Instant unread badge + thread sync on new specialist messages.
  useEffect(() => {
    if (!open) return;
    const channel = supabase
      .channel(`vip-user-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_messages" }, () => {
        qc.invalidateQueries({ queryKey: ["vip-directory"] });
        qc.invalidateQueries({ queryKey: ["vip-thread"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "vip_access" }, () => { qc.invalidateQueries({ queryKey: ["vip-directory"] }); qc.invalidateQueries({ queryKey: ["vip-thread"] }); })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, qc]);

  const sendMutation = useMutation({
    mutationFn: async (body: string) => {
      let attach: Record<string, unknown> = {};
      if (file) {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        if (!uid) throw new Error("Session expired - sign in again.");
        const path = `${uid}/vip/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
        if (error) throw new Error(error.message);
        attach = {
          attachmentPath: path,
          attachmentName: file.name,
          attachmentType: file.type,
          attachmentSize: file.size,
        };
      }
      return send({ data: { roleKey: activeRole as any, body, ...attach } as any });
    },
    onSuccess: () => {
      setDraft("");
      setFile(null);
      qc.invalidateQueries({ queryKey: ["vip-thread", activeRole] });
      qc.invalidateQueries({ queryKey: ["vip-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestMutation = useMutation({
    mutationFn: (roleKey: string) => request({ data: { roleKey: roleKey as any } }),
    onSuccess: () => {
      toast.success("Request queued.");
      qc.invalidateQueries({ queryKey: ["vip-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">VIP Live Chat</DialogTitle><DialogDescription className="sr-only">Priority Support department queue and private specialist conversation.</DialogDescription>
        <div className="flex h-[78vh] flex-col bg-card">
          {/* WhatsApp-style emerald header */}
          <header className="flex items-center gap-3 bg-ops-emerald px-4 py-3 text-foreground">
            {activeRole ? (
              <Button variant="ghost" size="icon" onClick={() => setActiveRole(null)} aria-label="Back to departments">
                <ArrowLeft className="size-5" />
              </Button>
            ) : (
              <ShieldCheck className="size-5" />
            )}
            {active?.connected && active.agent ? (
              <>
                <Initials name={active.agent.fullName} url={active.agent.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{active.agent.fullName}</p>
                  <p className="truncate text-[11px] text-primary-foreground">
                    {active.roleLabel} · {active.active ? "Active" : "Away"}
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-semibold">VIP Live Chat</p>
                <p className="text-[11px] text-primary-foreground">Dedicated specialists desk</p>
              </div>
            )}
          </header>

          {!active?.connected ? (
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-6">
              <div className="space-y-2">
                <label id="vip-department-label" className="text-sm font-medium">Department</label>
                <Select value={activeRole ?? undefined} onValueChange={value => { setActiveRole(value); setDraft(""); setFile(null); }}>
                  <SelectTrigger aria-labelledby="vip-department-label" className="min-h-11 w-full"><SelectValue placeholder="Select a department" /></SelectTrigger>
                  <SelectContent>{VIP_DEPARTMENTS.map(dept => <SelectItem key={dept.key} value={dept.key}>{dept.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {directory.isError ? <p role="alert" className="text-sm text-destructive">Support queue unavailable. Please retry.</p> : active?.requested ?
                <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 text-center"><Loader2 className="size-7 animate-spin text-ops-emerald motion-reduce:animate-none" /><p className="text-sm font-medium">Connecting to next available specialist...</p><p className="text-xs text-muted-foreground">{active.roleLabel}</p></div> :
                <Button className="min-h-11" disabled={!activeRole || directory.isPending || requestMutation.isPending} onClick={() => { if (activeRole) requestMutation.mutate(activeRole); }}>{requestMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}Connect to specialist</Button>}
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-card px-3 py-4">
                {(thread.data ?? []).length === 0 && (
                  <p className="text-center text-xs text-foreground/40">
                    Start the conversation with {active.agent?.fullName ?? "your specialist"}.
                  </p>
                )}
                {(thread.data ?? []).map((m: any) => {
                  const mine = m.senderRole === "user";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow ${
                          mine ? "bg-secondary text-foreground" : "bg-surface-raised text-foreground"
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
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-foreground/50">
                          {time(m.createdAt)}
                          {mine &&
                            (m.readAt ? (
                              <CheckCheck className="size-3 text-bull" />
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
                className="flex flex-col gap-2 bg-surface-raised px-3 py-2"
              >
                {file && (
                  <div className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1 text-[11px] text-foreground/80">
                    <Paperclip className="size-3" />
                    <span className="min-w-0 flex-1 truncate">{file.name}</span>
                    <span className="opacity-70">{formatBytes(file.size)}</span>
                    <Button type="button" onClick={() => setFile(null)} aria-label="Remove attachment">
                      <X className="size-3.5" />
                    </Button>
                  </div>
                )}
                <div className="flex items-end gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  hidden
                  accept="image/png,image/jpeg,image/webp,application/pdf,.doc,.docx,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="grid size-9 place-items-center rounded-full text-foreground/70 hover:text-foreground"
                  aria-label="Attach a file"
                >
                  <Paperclip className="size-5" />
                </Button>
                <ChatComposerInput
                  value={draft}
                  onChange={setDraft}
                  onSubmit={() => {
                    if (draft.trim() || file) sendMutation.mutate(draft.trim());
                  }}
                  placeholder="Message"
                  maxLength={2000}
                  className="rounded-2xl bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-foreground/40"
                />
                <Button
                  type="submit"
                  disabled={(!draft.trim() && !file) || sendMutation.isPending}
                  className="grid size-9 place-items-center rounded-full bg-ops-emerald text-foreground disabled:opacity-50"
                  aria-label="Send"
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
                </div>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
