import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AdminTableToolbar } from "@/components/admin/AdminTableToolbar";
import { AdminActionConfirm } from "@/components/admin/AdminActionConfirm";
import { listManagedOpenings, saveOpening, deleteOpening } from "@/lib/careers.functions";
import { EMPLOYMENT_TYPES, WORK_MODES, OPENING_STATUSES, openingSchema, type OpeningInput, type CareerOpening } from "@/lib/careers-shared";
import { downloadCsv } from "@/lib/csv";

const blank: OpeningInput = { title: "", businessGroup: "", country: "", location: "", employmentType: "Full-time", workMode: "Remote", duration: "", tags: [], description: "", requirements: "", applicationUrl: "", featured: false, status: "draft" };
const field = "mt-1.5 h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm";

function editInput(row: CareerOpening): OpeningInput {
  return openingSchema.parse({ id: row.id, title: row.title, businessGroup: row.business_group, country: row.country, location: row.location, employmentType: row.employment_type, workMode: row.work_mode, duration: row.duration, tags: row.tags, description: row.description, requirements: row.requirements, applicationUrl: row.application_url, featured: row.featured, status: row.status });
}

export function CareersManager() {
  const fetchRows = useServerFn(listManagedOpenings);
  const save = useServerFn(saveOpening);
  const remove = useServerFn(deleteOpening);
  const qc = useQueryClient();
  const rows = useQuery({ queryKey: ["careers", "managed"], queryFn: () => fetchRows() });
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<OpeningInput | null>(null);
  const [deleting, setDeleting] = useState<CareerOpening | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["careers"] });
  const write = useMutation({ mutationFn: (data: OpeningInput) => save({ data }), onSuccess: () => { refresh(); setEditor(null); toast.success("Opening saved"); }, onError: (e: Error) => toast.error(e.message) });
  const deletion = useMutation({ mutationFn: (id: string) => remove({ data: { id } }), onSuccess: () => { refresh(); toast.success("Opening deleted"); }, onError: (e: Error) => toast.error(e.message) });
  const all = rows.data ?? [];
  const filtered = all.filter(r => (status === "all" || r.status === status) && `${r.title} ${r.business_group} ${r.country} ${r.location}`.toLowerCase().includes(term.trim().toLowerCase()));
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">Current openings and publication</p>
      <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link to="/careers" target="_blank">Careers homepage <ExternalLink /></Link></Button><Button onClick={() => setEditor({ ...blank })}><Plus />New opening</Button></div>
    </div>
    <div className="grid grid-cols-3 gap-3">{OPENING_STATUSES.map(s => <div key={s} className="border-l-2 border-brand-teal px-3 py-2"><p className="text-xs capitalize text-muted-foreground">{s}</p><p className="mt-1 text-xl font-semibold tabular-nums">{all.filter(r => r.status === s).length}</p></div>)}</div>
    <div className="flex flex-wrap items-center justify-end gap-2 border-y border-border py-3">
      <select aria-label="Opening status" className="h-10 rounded-md border border-input bg-background px-3 text-xs" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{OPENING_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>
      <AdminTableToolbar term={term} onSearch={setTerm} onRefresh={refresh} refreshing={rows.isFetching} onExport={() => downloadCsv("careers-openings", filtered)} />
    </div>
    {rows.isPending ? <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Loading openings...</p> : rows.isError ? <p role="alert" className="text-destructive">{rows.error.message}</p> : filtered.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">{all.length ? "No openings match your filters." : "No openings yet."}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-3">Role</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3">Updated</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id} className="border-b border-border"><td className="p-3"><p className="font-semibold">{r.title}</p><p className="mt-1 text-xs text-muted-foreground">{r.business_group}{r.featured ? " - Featured" : ""}</p></td><td className="p-3">{r.location}<p className="text-xs text-muted-foreground">{r.country} - {r.work_mode}</p></td><td className={`p-3 capitalize ${r.status === "published" ? "text-ops-emerald" : "text-muted-foreground"}`}>{r.status}</td><td className="p-3 text-xs text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td><td className="p-3"><div className="flex justify-end gap-2"><Button variant="outline" size="icon" aria-label={`Edit ${r.title}`} title="Edit opening" onClick={() => setEditor(editInput(r))}><Pencil /></Button><Button variant="outline" size="icon" className="text-destructive" aria-label={`Delete ${r.title}`} title="Delete opening" onClick={() => setDeleting(r)}><Trash2 /></Button></div></td></tr>)}</tbody></table></div>}
    {editor && <OpeningEditor initial={editor} pending={write.isPending} onClose={() => setEditor(null)} onSave={data => write.mutate(data)} />}
    <AdminActionConfirm open={!!deleting} title="Delete opening" description={`Permanently delete ${deleting?.title ?? "this opening"}? The internal audit history is retained. Close the opening instead to keep its record.`} pending={deletion.isPending} noReason onClose={() => setDeleting(null)} onConfirm={async () => { if (deleting) await deletion.mutateAsync(deleting.id); }} />
  </div>;
}

function OpeningEditor({ initial, pending, onClose, onSave }: { initial: OpeningInput; pending: boolean; onClose: () => void; onSave: (data: OpeningInput) => void }) {
  const [form, setForm] = useState(initial);
  const [tags, setTags] = useState(initial.tags.join(", "));
  const [error, setError] = useState("");
  const set = <K extends keyof OpeningInput>(key: K, value: OpeningInput[K]) => setForm(p => ({ ...p, [key]: value }));
  const input = (key: "title" | "businessGroup" | "country" | "location" | "duration" | "applicationUrl", label: string, required = true) => <label className="min-w-0 text-sm font-medium">{label}<input className={field} value={form[key]} required={required} disabled={pending} onChange={e => set(key, e.target.value)} /></label>;
  return <Dialog open onOpenChange={v => { if (!v && !pending) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onPointerDownOutside={e => { if (pending) e.preventDefault(); }} onEscapeKeyDown={e => { if (pending) e.preventDefault(); }}><DialogTitle>{form.id ? "Edit opening" : "New opening"}</DialogTitle><DialogDescription>Role details and application destination</DialogDescription><form onSubmit={e => { e.preventDefault(); const parsed = openingSchema.safeParse({ ...form, tags: tags.split(",").map(t => t.trim()).filter(Boolean) }); if (!parsed.success) { setError(parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join(". ")); return; } setError(""); onSave(parsed.data); }} className="grid gap-5">
    <div className="grid gap-4 sm:grid-cols-2">{input("title", "Role title")}{input("businessGroup", "Business group")}{input("country", "Country")}{input("location", "Job location")}
      <label className="text-sm font-medium">Job type<select className={field} value={form.employmentType} disabled={pending} onChange={e => { const v = EMPLOYMENT_TYPES.find(t => t === e.target.value); if (v) set("employmentType", v); }}>{EMPLOYMENT_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
      <label className="text-sm font-medium">Work mode<select className={field} value={form.workMode} disabled={pending} onChange={e => { const v = WORK_MODES.find(t => t === e.target.value); if (v) set("workMode", v); }}>{WORK_MODES.map(t => <option key={t}>{t}</option>)}</select></label>
      {input("duration", "Duration (optional)", false)}<label className="text-sm font-medium">Tags (comma-separated)<input className={field} value={tags} disabled={pending} onChange={e => setTags(e.target.value)} /></label>
    </div>
    <label className="text-sm font-medium">Description<textarea rows={5} minLength={20} maxLength={6000} required disabled={pending} className={`${field} h-auto py-3`} value={form.description} onChange={e => set("description", e.target.value)} /></label>
    <label className="text-sm font-medium">Requirements (optional)<textarea rows={4} maxLength={6000} disabled={pending} className={`${field} h-auto py-3`} value={form.requirements} onChange={e => set("requirements", e.target.value)} /></label>
    {input("applicationUrl", "Application URL (https://)", form.status === "published")}
    <div className="flex flex-wrap items-end justify-between gap-4"><label className="text-sm font-medium">Publication status<select className={field} value={form.status} disabled={pending} onChange={e => { const v = OPENING_STATUSES.find(t => t === e.target.value); if (v) set("status", v); }}>{OPENING_STATUSES.map(t => <option key={t}>{t}</option>)}</select></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} disabled={pending} onChange={e => set("featured", e.target.checked)} className="size-4 accent-primary" />Featured on Careers homepage</label></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending && <Loader2 className="animate-spin" />}Save opening</Button></div>
  </form></DialogContent></Dialog>;
}