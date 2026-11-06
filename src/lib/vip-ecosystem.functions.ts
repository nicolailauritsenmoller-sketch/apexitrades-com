import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged, logAudit } from "./desk.server";
import { ecosystemSchema, ecosystemConfig } from "./vip-ecosystem";

export const getVipEcosystem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc("get_vip_ecosystem_config");
  if (error) throw new Error("VIP configuration unavailable.");
  return ecosystemConfig(data);
});
export const saveVipEcosystem = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ config: ecosystemSchema, reason: z.string().trim().min(5).max(400) }).parse(v)).handler(async ({ data, context }) => {
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
  return data as { id: string; user_id: string; reference: string | null; body: string; vip_credit_scenario: unknown; vip_credit_status: string; vip_credit_review_note: string | null; created_at: string }[];
});
export const reviewVipCredit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((v: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["approved_simulation", "rejected", "liquidated_simulation"]), reason: z.string().trim().min(5).max(400) }).parse(v)).handler(async ({ data, context }) => {
  await assertAdmin(context); const db = await privileged();
  const { data: ticket, error } = await db.from("support_tickets").update({ vip_credit_status: data.status, vip_credit_review_note: data.reason }).eq("id", data.id).eq("subject", "Treasury Operations - Credit Facility Simulation").select("user_id").single();
  if (error || !ticket) throw new Error("Credit scenario not found.");
  await logAudit(db, context.userId, "vip.credit_review", ticket.user_id, { ticket: data.id, status: data.status, reason: data.reason });
  await db.from("notifications").insert({ user_id: ticket.user_id, kind: "info", title: "Credit simulation review", body: `Treasury updated your credit scenario: ${data.status.replaceAll("_", " ")}. No funds have moved.` });
  return { ok: true };
});
export const getMyVipCredit = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("support_tickets").select("id,reference,vip_credit_status,vip_credit_review_note,created_at").eq("user_id", context.userId).eq("subject", "Treasury Operations - Credit Facility Simulation").order("created_at", { ascending: false }).limit(20);
  if (error) throw new Error("Credit review status unavailable."); return data;
});