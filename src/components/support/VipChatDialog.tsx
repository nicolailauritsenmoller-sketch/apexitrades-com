import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Check, CheckCheck, Lock, Mic, Send, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  if (url) {
    return <img src={url} alt={name} className="size-10 rounded-full object-cover" />;
  }
  const letters = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">
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
    enabled: open && !!activeRole && !!active?.unlocked,
    refetchInterval: 5000,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread.data]);

  const sendMutation = useMutation({
    mutationFn: (body: string) => send({ data: { roleKey: activeRole as any, body } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["vip-thread", activeRole] });
      qc.invalidateQueries({ queryKey: ["vip-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestMutation = useMutation({
    mutationFn: (roleKey: string) => request({ data: { roleKey: roleKey as any } }),
    onSuccess: () => {
      toast.success("Access requested — our support desk will unlock this specialist shortly.");
      qc.invalidateQueries({ queryKey: ["vip-directory"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden p-0 sm:max-w-lg">
        <div className="flex h-[78vh] flex-col bg-[#0b141a]">
          {/* WhatsApp-style emerald header */}
          <header className="flex items-center gap-3 bg-emerald-700 px-4 py-3 text-white">
            {activeRole ? (
              <button onClick={() => setActiveRole(null)} aria-label="Back to specialists">
                <ArrowLeft className="size-5" />
              </button>
            ) : (
              <ShieldCheck className="size-5" />
            )}
            {active ? (
              <>
                <Initials name={active.fullName} url={active.avatarUrl} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{active.fullName}</p>
                  <p className="truncate text-[11px] text-emerald-100">
                    {active.title} · <span className="font-bold">{active.staffId}</span>
                  </p>
                </div>
              </>
            ) : (
              <div>
                <p className="text-sm font-semibold">VIP Live Chat</p>
                <p className="text-[11px] text-emerald-100">Dedicated specialists desk</p>
              </div>
            )}
          </header>

          {!activeRole ? (
            <div className="flex-1 divide-y divide-white/5 overflow-y-auto">
              {(directory.data ?? []).map((s: any) => (
                <button
                  key={s.roleKey}
                  onClick={() => setActiveRole(s.roleKey)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/5"
                >
                  <Initials name={s.fullName} url={s.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{s.roleLabel}</p>
                    <p className="truncate text-xs text-white/60">
                      {s.fullName} · <span className="font-bold">{s.staffId}</span>
                    </p>
                  </div>
                  {s.unlocked ? (
                    s.unread > 0 ? (
                      <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
                        {s.unread}
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase text-emerald-400">
                        Open
                      </span>
                    )
                  ) : (
                    <Lock className="size-4 text-white/40" />
                  )}
                </button>
              ))}
            </div>
          ) : !active?.unlocked ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <Lock className="size-8 text-white/50" />
              <p className="text-sm font-semibold text-white">This specialist is locked</p>
              <p className="text-xs text-white/60">
                {active?.requested
                  ? "Your request is with our support desk. You'll be notified the moment it's unlocked."
                  : "Request access and our customer support team will unlock this dedicated thread for you."}
              </p>
              <button
                onClick={() => requestMutation.mutate(activeRole)}
                disabled={requestMutation.isPending || active?.requested}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {active?.requested ? "Request pending" : "Request access"}
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 space-y-2 overflow-y-auto bg-[#0b141a] px-3 py-4">
                {(thread.data ?? []).length === 0 && (
                  <p className="text-center text-xs text-white/40">
                    Start the conversation with {active.fullName}.
                  </p>
                )}
                {(thread.data ?? []).map((m: any) => {
                  const mine = m.senderRole === "user";
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow ${
                          mine ? "bg-emerald-800 text-white" : "bg-[#202c33] text-white"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-white/50">
                          {time(m.createdAt)}
                          {mine &&
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
                  if (draft.trim()) sendMutation.mutate(draft.trim());
                }}
                className="flex items-center gap-2 bg-[#202c33] px-3 py-2"
              >
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Message"
                  maxLength={2000}
                  className="flex-1 rounded-full bg-[#2a3942] px-4 py-2 text-sm text-white outline-none placeholder:text-white/40"
                />
                <span className="grid size-9 place-items-center text-white/50" title="Audio note">
                  <Mic className="size-5" />
                </span>
                <button
                  type="submit"
                  disabled={!draft.trim() || sendMutation.isPending}
                  className="grid size-9 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-50"
                  aria-label="Send"
                >
                  <Send className="size-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
