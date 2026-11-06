import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

type Row = { id: string; title: string; summary: string; body: string; category: string; published: boolean; created_at: string };
const empty = { title: "", summary: "", body: "", category: "Market Research" };

export function VipResearchDesk() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-vip-research"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vip_research_reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-vip-research"] });

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const res = editing
        ? await supabase.from("vip_research_reports").update(form).eq("id", editing)
        : await supabase.from("vip_research_reports").insert({ ...form, created_by: u.user?.id ?? null });
      if (res.error) throw res.error;
    },
    onSuccess: () => { toast.success(editing ? "Report updated." : "Draft saved."); setForm(empty); setEditing(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (r: Row) => {
      const { error } = await supabase.from("vip_research_reports").update({ published: !r.published }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vip_research_reports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Report deleted."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">{editing ? "Edit report" : "New VIP research report"}</h3>
        <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <Input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
        <Input placeholder="Short summary" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
        <Textarea placeholder="Full report" rows={10} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <div className="flex gap-2">
          <Button disabled={!form.title.trim() || !form.body.trim() || save.isPending} onClick={() => save.mutate()}>{editing ? "Save changes" : "Save draft"}</Button>
          {editing && <Button variant="ghost" onClick={() => { setEditing(null); setForm(empty); }}>Cancel</Button>}
        </div>
      </div>
      <div className="space-y-2">
        {list.data?.length === 0 && <p className="text-sm text-muted-foreground">No reports yet.</p>}
        {list.data?.map((r) => (
          <div key={r.id} className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.category} - {new Date(r.created_at).toLocaleDateString()}</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                {r.published ? "Published" : "Draft"}
                <Switch checked={r.published} onCheckedChange={() => toggle.mutate(r)} />
              </label>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setEditing(r.id); setForm({ title: r.title, summary: r.summary, body: r.body, category: r.category }); }}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-bear" onClick={() => confirm("Delete this report?") && remove.mutate(r.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
