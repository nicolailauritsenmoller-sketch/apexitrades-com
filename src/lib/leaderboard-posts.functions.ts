import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error || !data?.some((row: { role: string }) => row.role === "admin")) throw new Error("Admin access required");
}

async function audit(context: { supabase: any; userId: string }, action: string, details: Record<string, unknown>) {
  await context.supabase.from("admin_audit_logs").insert({ actor_id: context.userId, action, details });
}

/** Real closed trades from consenting approved leaders, plus every curated post. */
export const getLeaderboardManager = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await requireAdmin(context);
  const [desks, posts] = await Promise.all([
    context.supabase.rpc("leaderboard_desks", {}),
    context.supabase.from("leaderboard_posts").select("*").order("updated_at", { ascending: false }).limit(300),
  ]);
  if (desks.error) throw new Error(desks.error.message);
  if (posts.error) throw new Error(posts.error.message);
  return { trades: (desks.data ?? []) as Record<string, any>[], posts: posts.data ?? [] };
});

const nameSchema = z.string().trim().regex(/^[A-Za-z0-9_.-]{3,32}$/, "Use 3-32 letters, numbers, dot, dash or underscore").nullable();

export const saveLeaderboardDraft = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ positionId: z.string().uuid(), displayName: nameSchema, commentary: z.string().trim().max(280).nullable() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { data: row, error } = await context.supabase.from("leaderboard_posts").upsert({
      position_id: data.positionId, display_name: data.displayName || null, commentary: data.commentary || null,
      status: "draft", review_note: null, published_at: null, created_by: context.userId,
    }, { onConflict: "position_id" }).select("id").single();
    if (error) throw new Error(error.message);
    await audit(context, "leaderboard_post_draft", { post_id: row.id, position_id: data.positionId });
    return { id: row.id as string };
  });

export const reviewLeaderboardPost = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["publish", "reject", "unpublish"]), note: z.string().trim().max(400).optional() }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const values = data.action === "publish"
      ? { status: "published", published_at: new Date().toISOString(), review_note: null, reviewed_by: context.userId }
      : data.action === "reject"
        ? { status: "rejected", published_at: null, review_note: data.note || null, reviewed_by: context.userId }
        : { status: "draft", published_at: null, reviewed_by: context.userId };
    const { error } = await context.supabase.from("leaderboard_posts").update(values).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context, `leaderboard_post_${data.action}`, { post_id: data.id, note: data.note ?? null });
    return { ok: true };
  });
