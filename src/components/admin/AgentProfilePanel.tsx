import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { IdCard, Loader2, Monitor, Plus, Smartphone, Trash2, Upload, Check } from "lucide-react";
import { AGENT_ROLES } from "@/lib/agent-roles";
import {
  getMyPersonas, savePersona, switchPersona, setPersonaPresence, deletePersona, uploadPersonaAvatar,
} from "@/lib/agent-personas.functions";
import staff1 from "@/assets/avatars/staff-1.jpg";
import staff2 from "@/assets/avatars/staff-2.jpg";
import badgeShield from "@/assets/avatars/badge-shield.jpg";
import badgeSupport from "@/assets/avatars/badge-support.jpg";

const PRESETS = [
  { src: staff1, label: "Staff portrait A" },
  { src: staff2, label: "Staff portrait B" },
  { src: badgeShield, label: "Brand shield" },
  { src: badgeSupport, label: "Support badge" },
];
const LANGS = [
  { id: "en", label: "English" }, { id: "es", label: "Español" }, { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" }, { id: "ar", label: "العربية" }, { id: "zh", label: "中文" },
] as const;
type Lang = (typeof LANGS)[number]["id"];
const GREETINGS: Record<Lang, string> = {
  en: "Hello, this is {name}, {role}. I have picked up your request and will assist you now.",
  es: "Hola, soy {name}, {role}. He recibido su solicitud y le atenderé ahora.",
  fr: "Bonjour, ici {name}, {role}. J'ai pris en charge votre demande et je vous assiste dès maintenant.",
  de: "Guten Tag, hier ist {name}, {role}. Ich habe Ihre Anfrage übernommen und helfe Ihnen jetzt weiter.",
  ar: "مرحبًا، معك {name}، {role}. لقد استلمت طلبك وسأساعدك الآن.",
  zh: "您好，我是{name}，{role}。我已接手您的请求，现在为您服务。",
};
const PRESENCE = [
  { id: "available", label: "Available for Chat", dot: "bg-ops-emerald" },
  { id: "busy", label: "In Call / Busy", dot: "bg-ops-amber" },
  { id: "offline", label: "Offline", dot: "bg-muted-foreground" },
] as const;
type Presence = (typeof PRESENCE)[number]["id"];

type Form = {
  id?: string; label: string; fullName: string; agentRole: string; staffId: string; avatarUrl: string;
  signature: string; welcomeMessage: string; language: Lang; presence: Presence;
};
const blank = (): Form => ({
  label: "", fullName: "", agentRole: AGENT_ROLES[2], staffId: "", avatarUrl: "",
  signature: "", welcomeMessage: GREETINGS.en, language: "en", presence: "available",
});
const fromRow = (p: any): Form => ({
  id: p.id, label: p.label, fullName: p.full_name, agentRole: p.agent_role, staffId: p.staff_id,
  avatarUrl: p.avatar_url ?? "", signature: p.signature ?? "", welcomeMessage: p.welcome_message ?? "",
  language: p.language ?? "en", presence: p.presence ?? "available",
});
const fill = (t: string, f: Form) => t.replaceAll("{name}", f.fullName || "Agent").replaceAll("{role}", f.agentRole);
const input = "w-full rounded-md bg-secondary px-3 py-2 text-sm outline-none";

/** Staff persona manager: multiple presets, one-click shift switching, presence, signature and greeting. */
export function AgentProfilePanel() {
  const qc = useQueryClient();
  const fetchAll = useServerFn(getMyPersonas);
  const save = useServerFn(savePersona);
  const doSwitch = useServerFn(switchPersona);
  const doPresence = useServerFn(setPersonaPresence);
  const doDelete = useServerFn(deletePersona);
  const upload = useServerFn(uploadPersonaAvatar);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(blank);
  const [uploading, setUploading] = useState(false);

  const q = useQuery({ queryKey: ["my-agent-personas"], queryFn: () => fetchAll() });
  const personas = (q.data?.personas ?? []) as any[];
  const live = q.data?.live as any;
  const activeId = live?.active_persona_id as string | undefined;

  useEffect(() => {
    if (form.id || form.label || !q.data) return;
    const active = personas.find((p) => p.id === activeId);
    if (active) setForm(fromRow(active));
    else if (live) setForm({ ...blank(), label: "Primary", fullName: live.full_name ?? "", agentRole: live.agent_role ?? AGENT_ROLES[2], staffId: live.staff_id ?? "", avatarUrl: live.avatar_url ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["my-agent-personas"] });
    void qc.invalidateQueries({ queryKey: ["my-agent-profile"] });
  };
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const saveMut = useMutation({
    mutationFn: (activate: boolean) => save({ data: {
      id: form.id, label: form.label.trim(), fullName: form.fullName.trim(), agentRole: form.agentRole,
      staffId: form.staffId.trim(), avatarUrl: form.avatarUrl.trim() || null, signature: form.signature.trim() || null,
      welcomeMessage: form.welcomeMessage.trim() || null, language: form.language, presence: form.presence, activate,
    } }),
    onSuccess: (r, activate) => { toast.success(activate ? "Persona saved and activated." : "Persona saved."); setForm((f) => ({ ...f, id: r.id })); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const switchMut = useMutation({
    mutationFn: (id: string) => doSwitch({ data: { id } }),
    onSuccess: (_r, id) => { toast.success("Active persona switched."); const p = personas.find((x) => x.id === id); if (p) setForm(fromRow(p)); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const presenceMut = useMutation({
    mutationFn: (presence: Presence) => doPresence({ data: { presence } }),
    onSuccess: (_r, p) => { set("presence", p); toast.success("Presence updated."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: () => { toast.success("Persona deleted."); setForm(blank()); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(file: File) {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return toast.error("Use PNG, JPG or WEBP.");
    if (file.size > 2_000_000) return toast.error("Image must be 2 MB or smaller.");
    setUploading(true);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      const r = await upload({ data: { contentType: file.type as any, base64: btoa(bin) } });
      set("avatarUrl", r.url);
      toast.success("Avatar uploaded - save the persona to apply it.");
    } catch (e) { toast.error((e as Error).message); } finally { setUploading(false); }
  }

  const valid = form.label.trim().length >= 2 && form.fullName.trim().length >= 2 && form.staffId.trim().length >= 2;
  const livePresence = (live?.presence ?? "available") as Presence;

  return (
    <section className="rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <IdCard className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold tracking-tight">Agent persona</h2>
        <div className="ml-auto inline-flex rounded-md border border-border p-0.5">
          {PRESENCE.map((p) => (
            <button key={p.id} type="button" disabled={!live || presenceMut.isPending} onClick={() => presenceMut.mutate(p.id)}
              className={`flex items-center gap-1.5 rounded px-2 py-1 text-[11px] disabled:opacity-50 ${livePresence === p.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <span className={`size-2 rounded-full ${p.dot}`} />{p.label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Saved personas - click to switch shift</p>
            <div className="flex flex-wrap gap-2">
              {personas.map((p) => (
                <div key={p.id} className={`flex items-center gap-1 rounded-md border px-1 ${p.id === activeId ? "border-primary bg-primary/10" : "border-border"}`}>
                  <button type="button" onClick={() => setForm(fromRow(p))} className="flex items-center gap-2 px-2 py-1.5 text-xs">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="size-5 rounded-full object-cover" /> : <span className="size-5 rounded-full bg-secondary" />}
                    {p.label}{p.id === activeId && <Check className="size-3 text-primary" />}
                  </button>
                  {p.id !== activeId && (
                    <button type="button" disabled={switchMut.isPending} onClick={() => switchMut.mutate(p.id)} className="rounded bg-secondary px-2 py-1 text-[10px] font-semibold">Go live</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => setForm({ ...blank(), fullName: form.fullName, staffId: form.staffId })} className="flex items-center gap-1 rounded-md border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                <Plus className="size-3" /> New persona
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs sm:col-span-2"><span className="text-muted-foreground">Persona label</span>
              <input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="Sarah - VIP Account Manager" className={input} /></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Agent name</span>
              <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Sarah Jenkins" className={input} /></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Staff ID</span>
              <input value={form.staffId} onChange={(e) => set("staffId", e.target.value)} placeholder="#RM-408" className={input} /></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Role badge</span>
              <select value={form.agentRole} onChange={(e) => set("agentRole", e.target.value)} className={input}>
                {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select></label>
            <label className="space-y-1 text-xs"><span className="text-muted-foreground">Default presence for this persona</span>
              <select value={form.presence} onChange={(e) => set("presence", e.target.value as Presence)} className={input}>
                {PRESENCE.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select></label>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Avatar</p>
            <div className="flex flex-wrap items-center gap-2">
              {PRESETS.map((p) => {
                const abs = typeof window !== "undefined" ? new URL(p.src, window.location.origin).href : p.src;
                return (
                  <button key={p.label} type="button" title={p.label} onClick={() => set("avatarUrl", abs)}
                    className={`rounded-full ring-2 ${form.avatarUrl === abs ? "ring-primary" : "ring-transparent"}`}>
                    <img src={p.src} alt={p.label} loading="lazy" width={40} height={40} className="size-10 rounded-full object-cover" />
                  </button>
                );
              })}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1 rounded-md border border-border px-3 py-2 text-xs">
                {uploading ? <Loader2 className="size-3 animate-spin" /> : <Upload className="size-3" />} Upload (PNG/JPG/WEBP, 2 MB)
              </button>
            </div>
            <input value={form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} placeholder="Or paste an image URL https://..." className={input} />
          </div>

          <label className="block space-y-1 text-xs"><span className="text-muted-foreground">Agent email & chat signature (appended to ticket and priority support replies)</span>
            <input value={form.signature} onChange={(e) => set("signature", e.target.value)} maxLength={300} placeholder="Best regards, Sarah | Senior Risk Specialist" className={input} /></label>

          <div className="space-y-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Personal automated welcome message (sent when you pick up an unassigned chat)</span>
              <select value={form.language} onChange={(e) => set("language", e.target.value as Lang)} className="ml-auto rounded-md bg-secondary px-2 py-1 text-xs">
                {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <button type="button" onClick={() => set("welcomeMessage", GREETINGS[form.language])} className="rounded-md border border-border px-2 py-1 text-[11px]">Use template</button>
            </div>
            <textarea value={form.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} rows={3} maxLength={1000} dir={form.language === "ar" ? "rtl" : "ltr"} className={input} />
            <p className="text-[11px] text-muted-foreground">Placeholders: {"{name}"} and {"{role}"}.</p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {form.id && form.id !== activeId && (
              <button type="button" onClick={() => deleteMut.mutate(form.id!)} disabled={deleteMut.isPending} className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs text-destructive"><Trash2 className="size-3" /> Delete</button>
            )}
            <button type="button" onClick={() => saveMut.mutate(false)} disabled={!valid || saveMut.isPending} className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Save</button>
            <button type="button" onClick={() => saveMut.mutate(true)} disabled={!valid || saveMut.isPending} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
              {saveMut.isPending && <Loader2 className="size-3 animate-spin" />} Save & go live
            </button>
          </div>
        </div>

        <Preview f={form} />
      </div>
    </section>
  );
}

function Avatar({ f, size }: { f: Form; size: string }) {
  const dot = PRESENCE.find((p) => p.id === f.presence)?.dot;
  return (
    <span className="relative shrink-0">
      {f.avatarUrl ? <img src={f.avatarUrl} alt="" className={`${size} rounded-full object-cover`} /> : <span className={`${size} flex items-center justify-center rounded-full bg-secondary text-xs font-bold`}>{(f.fullName || "A")[0]}</span>}
      <span className={`absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-card ${dot}`} />
    </span>
  );
}

function Preview({ f }: { f: Form }) {
  const greeting = fill(f.welcomeMessage || "", f);
  const rtl = f.language === "ar";
  return (
    <div className="space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Live preview - as traders see it</p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-3 py-1.5 text-[10px] text-muted-foreground"><Monitor className="size-3" /> Desktop chat</div>
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar f={f} size="size-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{f.fullName || "Agent name"}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{f.agentRole}</span>
              <span className="font-mono text-[10px] text-muted-foreground">ID: {f.staffId || "#000"}</span>
            </div>
          </div>
        </div>
        {greeting && <div dir={rtl ? "rtl" : "ltr"} className="mx-3 mb-3 rounded-lg bg-secondary px-3 py-2 text-xs">{greeting}{f.signature && <p className="mt-2 text-muted-foreground">{f.signature}</p>}</div>}
      </div>
      <div className="mx-auto w-[240px] overflow-hidden rounded-[22px] border-4 border-secondary">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-3 py-1 text-[10px] text-muted-foreground"><Smartphone className="size-3" /> Mobile chat</div>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <Avatar f={f} size="size-8" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold">{f.fullName || "Agent name"}</p>
            <p className="truncate text-[10px] text-muted-foreground">{f.agentRole} · {f.staffId || "#000"}</p>
          </div>
        </div>
        {greeting && <div dir={rtl ? "rtl" : "ltr"} className="mx-2.5 mb-3 rounded-lg bg-secondary px-2.5 py-2 text-[11px]">{greeting}</div>}
      </div>
      {f.signature && <p className="text-[11px] text-muted-foreground">Ticket reply footer: <span className="text-foreground">{f.signature}</span></p>}
    </div>
  );
}
