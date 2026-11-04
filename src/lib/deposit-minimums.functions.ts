import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMinimum } from "@/lib/deposit-minimums";

async function isStaff(supabase: any, userId: string) {
  const [{ data: a }, { data: f }] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "finance" }),
  ]);
  return Boolean(a || f);
}

/** The signed-in trader's effective minimum for a coin. */
export const getMyDepositMinimum = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ coin: z.string().min(1).max(12) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows } = await (context.supabase as any)
      .from("deposit_minimums")
      .select("user_id,coin,min_amount")
      .ilike("coin", data.coin);
    return resolveMinimum(rows ?? [], context.userId, data.coin);
  });

/** Admin: global rules, or one user's overrides when userId is given. */
export const listDepositMinimums = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid().nullable() }).parse(i))
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.supabase, context.userId))) throw new Error("Forbidden");
    let q = (context.supabase as any).from("deposit_minimums").select("id,user_id,coin,min_amount,note,updated_at").order("coin");
    q = data.userId ? q.eq("user_id", data.userId) : q.is("user_id", null);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as { id: string; user_id: string | null; coin: string; min_amount: number; note: string | null; updated_at: string }[];
  });

export const saveDepositMinimum = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid().nullable(),
      coin: z.string().trim().min(1).max(12).transform((s) => s.toUpperCase()),
      minAmount: z.number().min(0).max(100_000_000).nullable(), // null = remove rule
      note: z.string().trim().max(300).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!(await isStaff(context.supabase, context.userId))) throw new Error("Forbidden");
    const sb = context.supabase as any;
    let del = sb.from("deposit_minimums").delete().eq("coin", data.coin);
    del = data.userId ? del.eq("user_id", data.userId) : del.is("user_id", null);
    const { error: dErr } = await del;
    if (dErr) throw new Error(dErr.message);
    if (data.minAmount !== null) {
      const { error } = await sb.from("deposit_minimums").insert({
        user_id: data.userId,
        coin: data.coin,
        min_amount: data.minAmount,
        note: data.note || null,
        updated_by: context.userId,
      });
      if (error) throw new Error(error.message);
    }
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await (supabaseAdmin as any).from("admin_audit_logs").insert({
        actor_id: context.userId,
        action: data.minAmount === null ? "deposit_minimum_removed" : "deposit_minimum_set",
        target_user_id: data.userId,
        details: { scope: data.userId ? "user" : "global", coin: data.coin, min_amount: data.minAmount, note: data.note ?? null },
      });
    } catch {
      /* audit failure should not hide a saved rule */
    }
    return { ok: true };
  });
