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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [positions, desks, posts] = await Promise.all([
    supabaseAdmin.from("positions").select("*").eq("status", "closed").not("realized_pnl", "is", null).gte("closed_at", since).order("closed_at", { ascending: false }).limit(300),
    context.supabase.rpc("leaderboard_desks", {}),
    context.supabase.from("leaderboard_posts").select("*").order("updated_at", { ascending: false }).limit(300),
  ]);
  if (positions.error) throw new Error(positions.error.message);
  if (desks.error) throw new Error(desks.error.message);
  if (posts.error) throw new Error(posts.error.message);
  const rows = positions.data ?? [];
  const ids = [...new Set(rows.map(p => p.user_id))];
  const profiles = ids.length ? (await supabaseAdmin.from("profiles").select("id,display_name,avatar_url").in("id", ids)).data ?? [] : [];
  const profileById = new Map(profiles.map(p => [p.id, p]));
  const consented = new Map(((desks.data ?? []) as Record<string, any>[]).map(d => [d.position_id as string, d]));
  // Internal list covers every recent closed trade; public eligibility still follows the trader's opt-in.
  const trades = rows.map(p => {
    const measured = consented.get(p.id);
    if (measured) return { ...measured, public_eligible: true };
    const margin = (Number(p.entry_price) * Number(p.quantity)) / Math.max(1, Number(p.leverage));
    return {
      position_id: p.id, leader_id: p.user_id, public_name: profileById.get(p.user_id)?.display_name ?? "Trader", bio: "",
      avatar_url: profileById.get(p.user_id)?.avatar_url ?? null, symbol: p.symbol, display_symbol: p.display_symbol,
      asset_class: p.asset_class, side: p.side, leverage: p.leverage, entry_price: p.entry_price, exit_price: p.exit_price,
      realized_pnl: p.realized_pnl, pnl_pct: margin > 0 ? (Number(p.realized_pnl) / margin) * 100 : null, closed_at: p.closed_at,
      trades_30d: 0, volume_30d: 0, pnl_30d: p.realized_pnl, margin_30d: margin, sharpe: null, sortino: null, max_drawdown_pct: null,
      kyc_verified: false, vip_level: 0, copy_traders: 0, views: 0, shares: 0, public_eligible: false,
    };
  });
  return { trades, posts: posts.data ?? [] };
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
