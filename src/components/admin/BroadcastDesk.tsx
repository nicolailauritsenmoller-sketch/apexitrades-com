import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Inbox, Loader2, Mail, Megaphone, Send, Smartphone, Upload, FlaskConical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { getBroadcastDesk, previewBroadcastAudience, sendBroadcast } from "@/lib/broadcast.functions";

type Channel = "banner" | "inbox" | "push" | "email";
const CHANNELS: { key: Channel; label: string; icon: any; ready: boolean }[] = [
  { key: "banner", label: "In-app banner / top alert bar", icon: Megaphone, ready: true },
  { key: "inbox", label: "System inbox message", icon: Inbox, ready: true },
  { key: "push", label: "Push notification (mobile)", icon: Smartphone, ready: false },
  { key: "email", label: "Transactional email (SMTP)", icon: Mail, ready: false },
];

const TEMPLATES = [
  { key: "maintenance", label: "Scheduled System Maintenance", severity: "warning", title: "Scheduled system maintenance", body: "Velocity Trade will undergo scheduled maintenance on [DATE] from [START] to [END] UTC. Trading and withdrawals may be briefly unavailable. Open positions remain protected." },
  { key: "margin_call", label: "Margin Call Warning", severity: "critical", title: "Margin call warning", body: "Your account margin level has fallen below the maintenance requirement. Add funds or reduce exposure to avoid liquidation of open positions." },
  { key: "listing", label: "New Market Listing", severity: "info", title: "New market listing", body: "[ASSET] is now available for trading on Velocity Trade. Visit Markets to view live quotes and open a position." },
  { key: "security", label: "Security Alert", severity: "critical", title: "Security alert", body: "We detected unusual activity on the platform. Never share your password or 2FA codes. Velocity Trade staff will never ask for them." },
] as const;

type AudKind = "all" | "kyc" | "vip" | "list" | "open_positions";

export function BroadcastDesk() {
  const qc = useQueryClient();
  const fetchDesk = useServerFn(getBroadcastDesk);
  const preview = useServerFn(previewBroadcastAudience);
  const send = useServerFn(sendBroadcast);
  const desk = useQuery({ queryKey: ["broadcast-desk"], queryFn: () => fetchDesk(), refetchInterval: 20_000 });

  const [kind, setKind] = useState<AudKind>("all");
  const [kycLevel, setKycLevel] = useState<"unverified" | "tier1" | "tier2">("tier1");
  const [minLevel, setMinLevel] = useState(1);
  const [minPortfolio, setMinPortfolio] = useState(0);
  const [listText, setListText] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["inbox"]);
  const [templateKey, setTemplateKey] = useState<string>("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("info");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [emergency, setEmergency] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const refs = useMemo(() => listText.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => s.length >= 3), [listText]);
  const audience = useMemo(() => {
    if (kind === "kyc") return { kind, level: kycLevel } as const;
    if (kind === "vip") return { kind, minLevel, minPortfolio } as const;
    if (kind === "list") return { kind, refs } as const;
    return { kind } as const;
  }, [kind, kycLevel, minLevel, minPortfolio, refs]);
  const audienceValid = kind !== "list" || refs.length > 0;

  const count = useQuery({
    queryKey: ["broadcast-preview", audience],
    queryFn: () => preview({ data: { audience: audience as any } }),
    enabled: audienceValid,
  });

  const mut = useMutation({
    mutationFn: (test: boolean) => send({ data: { title: title.trim(), body: body.trim(), templateKey: templateKey || null, severity, audience: audience as any, channels, test, emergency } }),
    onSuccess: (r, test) => {
      const skip = r.skipped.length ? ` ${r.skipped.join(" and ")} skipped (not configured).` : "";
      toast.success(`${test ? "Test sent to your account." : `Delivered to ${r.delivered} of ${r.recipients} account(s).`}${r.failed ? ` ${r.failed} failed.` : ""}${skip}`);
      if (!test) { setTitle(""); setBody(""); setTemplateKey(""); setEmergency(false); }
      qc.invalidateQueries({ queryKey: ["broadcast-desk"] });
      qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    const t = TEMPLATES.find((x) => x.key === templateKey);
    if (t) { setTitle(t.title); setBody(t.body); setSeverity(t.severity); }
  }, [templateKey]);

  const toggle = (c: Channel) => setChannels((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const canSend = title.trim().length >= 2 && body.trim().length >= 2 && channels.length > 0 && audienceValid && !mut.isPending;
  const t = desk.data?.totals;
  const sevCls = severity === "critical" ? "bg-destructive text-destructive-foreground" : severity === "warning" ? "bg-amber-500 text-black" : "bg-primary text-primary-foreground";
  const input = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { l: "Total sent", v: (t?.sent ?? 0).toLocaleString(), h: "Delivered, excluding tests" },
          { l: "Open / read rate", v: t?.readRate == null ? "-" : `${t.readRate.toFixed(1)}%`, h: "Inbox messages marked read" },
          { l: "Click-through rate", v: "-", h: "Link click tracking not enabled" },
          { l: "Delivery failures", v: (t?.failures ?? 0).toLocaleString(), h: "Failed or unmatched recipients" },
        ].map((c) => (
          <div key={c.l} className="rounded-lg border border-border bg-card p-4">
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.l}</p>
            <p className="mt-2 font-mono text-2xl font-bold tabular-nums">{c.v}</p>
            <p className="text-xs text-muted-foreground">{c.h}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <section className="space-y-5 rounded-lg border border-border bg-card p-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">1. Audience</h3>
            <div className="flex flex-wrap gap-1.5">
              {([["all", "All active traders"], ["kyc", "KYC level"], ["vip", "VIP / high-net-worth"], ["list", "UIDs or email list"], ["open_positions", "Open positions"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setKind(k)} className={`touch-manipulation rounded-full border px-3 py-1.5 text-xs font-semibold ${kind === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
              ))}
            </div>
            {kind === "kyc" && (
              <select value={kycLevel} onChange={(e) => setKycLevel(e.target.value as any)} className={input}>
                <option value="unverified">Unverified</option><option value="tier1">Tier 1 Verified</option><option value="tier2">Tier 2 (Level 2 approved)</option>
              </select>
            )}
            {kind === "vip" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">Minimum VIP tier<input type="number" min={1} max={10} value={minLevel} onChange={(e) => setMinLevel(Math.max(1, Number(e.target.value) || 1))} className={`${input} mt-1`} /></label>
                <label className="text-xs text-muted-foreground">Minimum portfolio (USDT)<input type="number" min={0} value={minPortfolio} onChange={(e) => setMinPortfolio(Math.max(0, Number(e.target.value) || 0))} className={`${input} mt-1`} /></label>
              </div>
            )}
            {kind === "list" && (
              <div className="space-y-2">
                <textarea value={listText} onChange={(e) => setListText(e.target.value)} rows={3} placeholder="Paste UIDs or emails, separated by commas or new lines" className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs" />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-semibold hover:bg-secondary">
                  <Upload className="size-3.5" />Upload CSV / TXT
                  <input type="file" hidden accept=".csv,.txt,text/csv,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setListText((p) => `${p}\n${await f.text()}`.trim()); e.target.value = ""; }} />
                </label>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {count.isFetching ? "Counting recipients..." : count.data ? <>Matches <b className="font-mono text-foreground">{count.data.count}</b> account(s){count.data.unmatched ? `, ${count.data.unmatched} entries not found` : ""}.</> : audienceValid ? "" : "Add at least one UID or email."}
              {kind !== "list" && " Frozen and suspended accounts are excluded."}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">2. Channels</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHANNELS.map((c) => (
                <label key={c.key} className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${channels.includes(c.key) ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="checkbox" checked={channels.includes(c.key)} onChange={() => toggle(c.key)} className="size-4 accent-primary" />
                  <c.icon className="size-4 text-muted-foreground" />
                  <span className="flex-1">{c.label}</span>
                  {!c.ready && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Not configured</span>}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">3. Message</h3>
            <div className="grid grid-cols-2 gap-2">
              <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} className={input} aria-label="Preset template">
                <option value="">Preset templates...</option>
                {TEMPLATES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
              <select value={severity} onChange={(e) => setSeverity(e.target.value as any)} className={input} aria-label="Severity">
                <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
              </select>
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Subject / title" className={input} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={4} placeholder="Message body" className="w-full rounded-md border border-input bg-background p-3 text-sm" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={emergency} onChange={(e) => setEmergency(e.target.checked)} className="size-4 accent-destructive" /><AlertTriangle className="size-4 text-destructive" />Emergency system announcement</label>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            <Button variant="outline" disabled={!canSend} onClick={() => mut.mutate(true)}>
              {mut.isPending && mut.variables === true ? <Loader2 className="animate-spin" /> : <FlaskConical />}Send test to me
            </Button>
            <Button variant={emergency ? "destructive" : "default"} disabled={!canSend} onClick={() => setConfirm(true)}><Send />Send broadcast</Button>
          </div>
        </section>

        <aside className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live preview</h3>
          {channels.includes("banner") && (
            <div className={`rounded-md px-3 py-2 text-xs font-medium ${sevCls}`}><b>{title || "Title"}</b> - {body.slice(0, 90) || "Message body"}</div>
          )}
          {channels.includes("inbox") && (
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="flex items-center gap-2 text-sm font-semibold"><Bell className="size-4 text-primary" />{title || "Title"}</p>
              <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{body || "Message body"}</p>
            </div>
          )}
          {channels.includes("push") && (
            <div className="rounded-2xl border border-border bg-secondary p-3 shadow-sm">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Velocity Trade · now</p>
              <p className="text-sm font-semibold">{title || "Title"}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{body || "Message body"}</p>
            </div>
          )}
          {channels.includes("email") && (
            <div className="overflow-hidden rounded-lg border border-border bg-background">
              <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">Subject: <span className="text-foreground">{title || "Title"}</span></div>
              <div className="space-y-2 p-3 text-xs"><p className="font-bold">Velocity Trade</p><p className="whitespace-pre-wrap">{body || "Message body"}</p></div>
            </div>
          )}
          {channels.some((c) => c === "push" || c === "email") && <p className="text-xs text-muted-foreground">Push and email have no delivery service connected yet; they are logged as skipped.</p>}
        </aside>
      </div>

      <section className="overflow-x-auto rounded-lg border border-border bg-card">
        <header className="border-b border-border px-4 py-3 text-sm font-semibold">Broadcast log</header>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="text-left text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr className="border-b border-border"><th className="px-4 py-2">Timestamp</th><th>Subject</th><th>Audience</th><th>Channels</th><th>Status</th><th>Read</th><th className="pr-4">Operator</th></tr>
          </thead>
          <tbody>
            {(desk.data?.rows ?? []).map((r: any) => (
              <tr key={r.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-2 font-mono text-xs">{new Date(r.created_at).toLocaleString()}</td>
                <td className="max-w-[240px] truncate">{r.emergency && <AlertTriangle className="mr-1 inline size-3.5 text-destructive" />}{r.title}</td>
                <td className="text-xs">{r.audience_label}</td>
                <td className="text-xs">{r.channels.map((c: string) => <span key={c} className={`mr-1 rounded px-1.5 py-0.5 ${r.skipped_channels?.includes(c) ? "bg-muted text-muted-foreground line-through" : "bg-secondary"}`}>{c}</span>)}</td>
                <td className="text-xs"><span className={`rounded px-1.5 py-0.5 font-semibold ${r.status === "sent" ? "bg-bull/15 text-bull" : r.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-amber-400/15 text-amber-500"}`}>{r.is_test ? "TEST " : ""}{r.status.toUpperCase()}</span> <span className="font-mono text-muted-foreground">{r.delivered}/{r.recipients}</span></td>
                <td className="font-mono text-xs">{r.inboxCount ? `${Math.round((r.readCount / r.inboxCount) * 100)}%` : "-"}</td>
                <td className="pr-4 text-xs">{r.actor_name}<span className="block font-mono text-muted-foreground">{r.actor_staff_id}</span></td>
              </tr>
            ))}
            {!desk.data?.rows?.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{desk.isLoading ? "Loading..." : "No broadcasts yet."}</td></tr>}
          </tbody>
        </table>
      </section>

      <AdminActionConfirm
        open={confirm}
        destructive={emergency}
        optionalNote
        title={emergency ? "Send emergency broadcast" : "Send broadcast"}
        description={`Send "${title}" to ${count.data?.count ?? 0} account(s) via ${channels.join(", ")}. This is recorded in the audit log.`}
        pending={mut.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() => mut.mutateAsync(false)}
      />
    </div>
  );
}
