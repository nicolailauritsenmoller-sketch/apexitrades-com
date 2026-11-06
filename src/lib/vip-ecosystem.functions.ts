import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged, logAudit } from "./desk.server";
import { ecosystemSchema, ecosystemConfig } from "./vip-ecosystem";
import { creditScenarioSchema } from "./institutional-credit";

export const getVipEcosystem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("get_vip_ecosystem_config");
  if (error) throw new Error("VIP configuration unavailable.");
  return ecosystemConfig(data);
});
export const saveVipEcosystem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ config: ecosystemSchema, reason: z.string().trim().max(400).optional().default("") }).parse(v)).handler(async ({ data, context }) => {
  await assertAdmin(context); const db = await privileged();
  const { error } = await db.from("platform_settings").upsert({ key: "vip_ecosystem", value: data.config, updated_at: new Date().toISOString() });
  if (error) throw new Error("Could not save VIP controls.");
  await logAudit(db, context.userId, "vip.ecosystem_saved", null, { reason: data.reason, config: data.config });
  return { ok: true };
});
export const getVipCreditDesk = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context); const db = await privileged();
  const { data, error } = await db.from("support_tickets").select("id,user_id,reference,body,vip_credit_scenario,vip_credit_status,vip_credit_review_note,created_at").eq("subject", "Treasury Operations - Credit Facility Simulation").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error("Credit requests unavailable.");
  const rows = (data ?? []) as { id: string; user_id: string; reference: string | null; body: string; vip_credit_scenario: unknown; vip_credit_status: string; vip_credit_review_note: string | null; created_at: string }[];
  return rows.map(row => {
    const parsed = creditScenarioSchema.safeParse(row.vip_credit_scenario);
    return { ...row, vip_credit_scenario: parsed.success ? parsed.data : null };
  });
});
export const reviewVipCredit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["approved_simulation", "rejected", "liquidated_simulation"]), reason: z.string().trim().min(5).max(400) }).parse(v)).handler(async ({ data, context }) => {
  await assertAdmin(context); const db = await privileged();
  const { error } = await db.rpc("review_vip_credit", { p_id: data.id, p_status: data.status, p_reason: data.reason, p_actor: context.userId });
  if (error) throw new Error("Could not apply credit review. Liquidation requires an approved scenario.");
  return { ok: true };
});
export const getMyVipCredit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("support_tickets").select("id,reference,vip_credit_status,vip_credit_review_note,vip_credit_drawdown_at,created_at").eq("user_id", context.userId).eq("subject", "Treasury Operations - Credit Facility Simulation").order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Credit review status unavailable."); return data;
});
export const recordVipDrawdown = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v)).handler(async ({ data, context }) => {
  const { data: ticket, error } = await context.supabase.from("support_tickets").select("id,vip_credit_status").eq("id", data.id).eq("user_id", context.userId).single();
  if (error || ticket?.vip_credit_status !== "approved_simulation") throw new Error("Treasury approval required for this simulation.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: drawError } = await supabaseAdmin.rpc("record_vip_simulated_drawdown", { p_id: data.id, p_user: context.userId });
  if (drawError) throw new Error("Could not record simulated drawdown.");
  return { ok: true };
});