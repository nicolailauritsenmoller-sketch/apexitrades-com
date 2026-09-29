import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";

const rate = z.number().min(-1).max(5);

async function audit(db: any, actorId: string, action: string, target: string | null, details: Record<string, unknown>) {
  const { data: me } = await db.from("profiles").select("display_name").eq("id", actorId).maybeSingle();
  await db.from("admin_audit_logs").insert({
    actor_id: actorId,
    actor_name: me?.display_name ?? null,
    action,
    target_user_id: target,
    details,
  });
}

/** Tier matrix, grace setting, upgrade recommendations, active levels and recent VIP logs. */
export const getVipTierDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const [tiers, grace, accounts, logs] = await Promise.all([
      db.from("vip_fee_tiers").select("*").order("level"),
      db.from("platform_settings").select("value").eq("key", "vip_grace_days").maybeSingle(),
      db.from("vip_accounts").select("*").or("level.gt.0,recommended_level.not.is.null,grace_until.not.is.null").limit(500),
      db.from("admin_audit_logs").select("id,actor_name,action,target_user_id,details,created_at")
        .like("action", "vip.%").order("created_at", { ascending: false }).limit(50),
    ]);
    const ids = [...new Set([...(accounts.data ?? []).map((a: any) => a.user_id), ...(logs.data ?? []).map((l: any) => l.target_user_id).filter(Boolean)])];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,display_name,uid,email").in("id", ids)
      : { data: [] as any[] };
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const withProfile = (a: any) => ({ ...a, profile: pmap.get(a.user_id) ?? null });
    return {
      tiers: tiers.data ?? [],
      graceDays: Number((grace.data as any)?.value ?? 14),
      accounts: (accounts.data ?? []).map(withProfile),
      logs: (logs.data ?? []).map((l: any) => ({ ...l, profile: pmap.get(l.target_user_id) ?? null })),
    };
  });

const tierInput = z.object({
  level: z.number().int().min(0).max(20),
  name: z.string().trim().min(1).max(40),
  min_spot_volume: z.number().min(0),
  min_futures_volume: z.number().min(0),
  min_scalp_volume: z.number().min(0),
  min_portfolio_usdt: z.number().min(0),
  spot_maker: rate,
  spot_taker: rate,
  futures_maker: rate,
  futures_taker: rate,
  scalp_maker: rate,
  scalp_taker: rate,
});

export const upsertVipTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => tierInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("vip_fee_tiers").upsert({ ...data, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "vip.tier_saved", null, data);
    return { ok: true };
  });

export const deleteVipTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ level: z.number().int().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { count } = await db.from("vip_accounts").select("user_id", { count: "exact", head: true }).eq("level", data.level);
    if ((count ?? 0) > 0) throw new Error(`${count} account(s) are on this tier. Move them first.`);
    await db.from("vip_fee_tiers").delete().eq("level", data.level);
    await audit(db, context.userId, "vip.tier_deleted", null, { level: data.level });
    return { ok: true };
  });

export const setVipGraceDays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ days: z.number().int().min(0).max(180) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    await db.from("platform_settings").upsert({ key: "vip_grace_days", value: data.days, updated_at: new Date().toISOString() });
    await audit(db, context.userId, "vip.grace_setting", null, { days: data.days });
    return { ok: true };
  });

export const runVipEvaluation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { evaluateVipLevels } = await import("./vip-fees.server");
    return evaluateVipLevels(db, context.userId);
  });

/** Admin sets (or approves a recommended) tier level for one account. */
export const setVipLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), level: z.number().int().min(0).max(20) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: prev } = await db.from("vip_accounts").select("level").eq("user_id", data.userId).maybeSingle();
    const { error } = await db.from("vip_accounts").upsert({
      user_id: data.userId,
      level: data.level,
      recommended_level: null,
      grace_until: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    if (data.level > 0) {
      await db.from("profiles").update({ vip_tier: "vip1", vip_upgraded_at: new Date().toISOString() }).eq("id", data.userId).neq("vip_tier", "vip1");
    } else {
      await db.from("profiles").update({ vip_tier: "regular", vip_upgraded_at: null }).eq("id", data.userId).eq("vip_tier", "vip1");
    }
    await audit(db, context.userId, "vip.level_set", data.userId, { from: Number((prev as any)?.level ?? 0), to: data.level });
    return { ok: true };
  });

/** Tier, effective fees, override and account manager for the user compliance view. */
export const getUserVipFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const [{ data: account }, { data: override }, { data: tiers }] = await Promise.all([
      db.from("vip_accounts").select("*").eq("user_id", data.userId).maybeSingle(),
      db.from("user_fee_overrides").select("*").eq("user_id", data.userId).maybeSingle(),
      db.from("vip_fee_tiers").select("*").order("level"),
    ]);
    const level = Number((account as any)?.level ?? 0);
    const tier = [...(tiers ?? [])].reverse().find((t: any) => t.level <= level) ?? null;
    return { account, override, tier, tiers: tiers ?? [], level };
  });

const optRate = rate.nullable();
export const setUserFeeOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      clear: z.boolean().optional(),
      spot_maker: optRate, spot_taker: optRate,
      futures_maker: optRate, futures_taker: optRate,
      scalp_maker: optRate, scalp_taker: optRate,
      note: z.string().trim().max(300).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { userId, clear, ...rates } = data;
    if (clear) {
      await db.from("user_fee_overrides").delete().eq("user_id", userId);
      await audit(db, context.userId, "vip.fee_override_cleared", userId, {});
      return { ok: true };
    }
    const { error } = await db.from("user_fee_overrides").upsert({ user_id: userId, ...rates, updated_by: context.userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await audit(db, context.userId, "vip.fee_override_set", userId, rates);
    return { ok: true };
  });

export const setAccountManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      name: z.string().trim().max(80).nullable(),
      email: z.string().trim().email().max(160).nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: acc } = await db.from("vip_accounts").select("level").eq("user_id", data.userId).maybeSingle();
    if (data.name && Number((acc as any)?.level ?? 0) < 3) throw new Error("Account managers are assigned to Tier 3 and above.");
    await db.from("vip_accounts").upsert({
      user_id: data.userId,
      level: Number((acc as any)?.level ?? 0),
      account_manager_name: data.name,
      account_manager_email: data.email,
      updated_at: new Date().toISOString(),
    });
    await audit(db, context.userId, "vip.account_manager", data.userId, { name: data.name, email: data.email });
    if (data.name) {
      await db.from("notifications").insert({
        user_id: data.userId,
        title: "Dedicated account manager assigned",
        body: `${data.name} is now your dedicated account manager${data.email ? ` - ${data.email}` : ""}.`,
        kind: "info",
      });
    }
    return { ok: true };
  });

/** Customer-facing: dedicated account manager contact, if assigned. */
export const getMyAccountManager = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("vip_accounts")
      .select("account_manager_name,account_manager_email,level")
      .eq("user_id", context.userId)
      .maybeSingle();
    const d = data as any;
    if (!d?.account_manager_name || Number(d.level) < 3) return null;
    return { name: d.account_manager_name as string, email: (d.account_manager_email ?? null) as string | null };
  });
