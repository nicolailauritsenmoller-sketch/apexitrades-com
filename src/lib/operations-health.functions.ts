import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "./desk.server";

export const getOperationsHealth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const db = await privileged();
  const results = await Promise.all([
    db.rpc("operations_health_summary"),
    db.from("operations_feed_checks").select("*").order("feed"),
    db.from("deposit_addresses").select("id,coin,network,address,memo,active,status"),
    db.from("platform_setting_revisions").select("id,key,created_at,before_value").order("created_at", { ascending: false }).limit(20),
    db.from("broadcast_logs").select("id,status,delivered,failed,created_at").order("created_at", { ascending: false }).limit(10),
    db.from("scalping_tier_rules").select("id,label,duration_seconds,min_trade_amount,max_trade_amount,daily_payout_cap,commission_pct,active,deleted_at").eq("active", true).is("deleted_at", null),
    db.from("platform_settings").select("value").eq("key", "risk_controls").maybeSingle(),
    db.from("financial_review_approvals").select("request_id,approver_id").eq("request_kind", "withdrawal").limit(500),
    db.from("balance_correction_requests").select("id,user_id,currency,amount,mode,kind,requested_by,created_at").eq("status", "pending").order("created_at"),
  ]);
  if (results.some(r => r.error)) throw new Error("Operations data could not be fully loaded. Refresh to retry.");
  const { validateAssetAddress } = await import("./address-validation");
  const addresses: { id: string; coin: string; network: string; active: boolean; issue: string | null }[] = (results[2].data ?? []).map((row: any) => ({ id: row.id, coin: row.coin, network: row.network, active: row.active && row.status === "active", issue: validateAssetAddress(row.coin, row.network, row.address, row.memo) }));
  const revisions: { id: string; key: string; created_at: string; restorable: boolean }[] = (results[3].data ?? []).map((r: any) => ({ id: r.id, key: r.key, created_at: r.created_at, restorable: r.before_value !== null }));
  return { asOf: new Date().toISOString(), operatorId: context.userId, summary: results[0].data as any, feeds: results[1].data as any[], addresses, revisions, broadcasts: results[4].data as any[], tiers: results[5].data as any[], controls: results[6].data?.value ?? {}, approvals: results[7].data as any[], corrections: results[8].data as any[] };
});

export const checkOperationsFeeds = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertAdmin(context);
  const db = await privileged();
  const { data, error } = await db.rpc("claim_operations_feed_check");
  if (error) throw new Error("Could not start feed checks.");
  if (!data) return { ok: true, skipped: true };
  const { runFeedChecks } = await import("./operations-health.server");
  await runFeedChecks(db);
  return { ok: true, skipped: false };
});

export const restoreOperationsSetting = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ revisionId: z.string().uuid(), reason: z.string().trim().min(5).max(400) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { assertSensitiveOperator } = await import("./operator-security.server");
    await assertSensitiveOperator(context);
    const db = await privileged();
    const { error } = await db.rpc("restore_platform_setting", { p_revision: data.revisionId, p_actor: context.userId, p_reason: data.reason });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewOperationsCorrection = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { assertFinance } = await import("./desk.server");
    await assertFinance(context);
    const { assertSensitiveOperator } = await import("./operator-security.server");
    await assertSensitiveOperator(context);
    const db = await privileged();
    const { error } = await db.rpc("review_balance_correction", { p_id: data.id, p_actor: context.userId, p_action: data.action });
    if (error) throw new Error(error.message);
    return { ok: true };
  });