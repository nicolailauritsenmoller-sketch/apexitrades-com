import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Radio, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INSIGHT_CATEGORIES, useMarketInsights } from "@/lib/use-market-insights";

export function MarketInsightsDesk() {
  const qc = useQueryClient();
  const list = useMarketInsights("admin-market-insights", true);
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("Velocity Research Desk");
  const [category, setCategory] = useState<string>("crypto");
  const [content, setContent] = useState("");

  const publish = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("market_insights").insert({
        title: title.trim(),
        source: source.trim(),
        category,
        content: content.trim(),
        created_by: u.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Market insight dispatched to all traders");
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["market-insights"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("market_insights").update({ active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["market-insights"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = title.trim().length >= 3 && source.trim().length >= 2 && content.trim().length >= 5;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Market Intelligence dispatcher</h3>
        <span className="text-xs text-muted-foreground">
          - published insights appear at the top of every trader's Analytics feed instantly
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} className="md:col-span-3" />
        <Input placeholder="Source" value={source} maxLength={80} onChange={(e) => setSource(e.target.value)} className="md:col-span-2" />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm capitalize"
        >
          {INSIGHT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <Textarea placeholder="Content" value={content} maxLength={2000} rows={4} onChange={(e) => setContent(e.target.value)} className="md:col-span-3" />
      </div>
      <div className="mt-3 flex justify-end">
        <Button disabled={!valid || publish.isPending} onClick={() => publish.mutate()}>
          {publish.isPending ? <Loader2 className="animate-spin" /> : <Send />}
          Dispatch insight
        </Button>
      </div>
      <div className="mt-5 divide-y divide-border border-t border-border">
        {list.isPending && <p className="py-3 text-xs text-muted-foreground">Loading...</p>}
        {!list.isPending && !list.data?.length && (
          <p className="py-3 text-xs text-muted-foreground">No insights published yet.</p>
        )}
        {list.data?.map((i) => (
          <div key={i.id} className="flex items-start gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                {i.category} · {i.source} · {new Date(i.created_at).toLocaleString()}
                {!i.active && " · Withdrawn"}
              </p>
              <p className="text-sm font-semibold">{i.title}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{i.content}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: i.id, active: !i.active })}
            >
              {i.active ? "Withdraw" : "Republish"}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
