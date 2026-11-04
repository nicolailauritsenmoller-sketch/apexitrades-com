import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error || !data?.some((row: { role: string }) => row.role === "admin")) throw new Error("Admin access required");
}
export const getDiscoveryDesk = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [moderation, articles, snapshots, leaders] = await Promise.all([
    supabaseAdmin.from("discovery_moderation").select("*").order("updated_at", { ascending: false }).limit(300),
    context.supabase.from("discovery_articles").select("*").order("updated_at", { ascending: false }).limit(100),
    context.supabase.from("desk_performance_snapshots").select("*").order("captured_at", { ascending: false }).limit(100),
    context.supabase.rpc("leaderboard_desks", {}),
  ]);
  for (const result of [moderation, articles, snapshots, leaders]) if (result.error) throw new Error(result.error.message);
  return { moderation: moderation.data ?? [], articles: articles.data ?? [], snapshots: snapshots.data ?? [], leaders: leaders.data ?? [] };
});
export const saveDiscoveryModeration = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ kind: z.enum(["listing", "alpha", "news"]), contentId: z.string().trim().min(1).max(200), status: z.enum(["approved", "hidden", "featured"]), priority: z.number().int().min(0).max(100), reason: z.string().trim().min(3).max(500) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { error } = await context.supabase.from("discovery_moderation").upsert({ content_kind: data.kind, content_id: data.contentId, status: data.status, priority: data.priority, reason: data.reason, reviewed_by: context.userId }, { onConflict: "content_kind,content_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
export const saveDiscoveryArticle = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid().optional(), title: z.string().trim().min(3).max(180), excerpt: z.string().trim().min(10).max(3000), category: z.enum(["stocks", "crypto", "defi", "commodities", "forex", "macro", "regulation"]), tickers: z.array(z.string().regex(/^[A-Z0-9=.-]{1,24}$/)).max(12), status: z.enum(["draft", "published", "withdrawn"]) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { id, ...values } = data;
    const result = id ? await context.supabase.from("discovery_articles").update(values).eq("id", id).select("id").single() : await context.supabase.from("discovery_articles").insert({ ...values, created_by: context.userId }).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { id: result.data.id };
  });
export const captureDeskPerformance = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("capture_desk_performance");
  if (error) throw new Error(error.message);
  return { captured: data };
});