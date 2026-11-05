import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scalpingRuleInput, type ScalpingRule } from "./scalping-rules";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  if (error || !data?.some((row: { role: string }) => row.role === "admin")) throw new Error("Administrator access required.");
}

export const getScalpingRules = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ admin: z.boolean().default(false) }).parse(input))
  .handler(async ({ context, data }): Promise<ScalpingRule[]> => {
    if (data.admin) await requireAdmin(context);
    let query = context.supabase.from("scalping_tier_rules")
      .select("id,label,duration_seconds,min_trade_amount,roi_pct,active,updated_at,deleted_at")
      .is("deleted_at", null).order("duration_seconds").order("min_trade_amount");
    if (!data.admin) query = query.eq("active", true);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    return result.data ?? [];
  });

export const saveScalpingRule = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scalpingRuleInput.parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const { id, reason, ...values } = data;
    const row = { ...values, audit_reason: reason };
    const result = id
      ? await context.supabase.from("scalping_tier_rules").update(row).eq("id", id).is("deleted_at", null).select("id").single()
      : await context.supabase.from("scalping_tier_rules").insert(row).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { id: result.data.id };
  });

export const removeScalpingRule = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), reason: z.string().trim().min(5).max(400) }).parse(input))
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const result = await context.supabase.from("scalping_tier_rules")
      .update({ active: false, deleted_at: new Date().toISOString(), audit_reason: data.reason })
      .eq("id", data.id).is("deleted_at", null).select("id").single();
    if (result.error) throw new Error(result.error.message);
    return { id: result.data.id };
  });