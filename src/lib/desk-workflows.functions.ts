import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, assertStaff, logAudit, myRoles, privileged } from "./desk.server";

const STABLE = new Set(["USDT", "USDC", "USD", "BUSD", "DAI"]);

/** Super Admins or agents whose desk role is Compliance/KYC Officer. */
async function assertCompliance(context: { supabase: any; userId: string }) {
  const roles = await myRoles(context);
  if (roles.includes("admin")) return;
  if (roles.includes("agent")) {
    const db = await privileged();
    const { data } = await db.from("agent_profiles").select("agent_role").eq("user_id", context.userId).maybeSingle();
    if (data?.agent_role === "Compliance/KYC Officer") return;
  }
  throw new Error("Forbidden: compliance officer access required.");
}

/** Manual KYC status override with mandatory audit note; notifies the customer. */
export const overrideKycStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      level: z.union([z.literal(1), z.literal(2)]),
      status: z.enum(["approved", "rejected", "pending"]),
      reason: z.string().trim().min(5).max(500),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertCompliance(context);
    const db = await privileged();
    const { data: before } = await db.from("kyc_submissions").select("id,status,level2_status").eq("user_id", data.userId).maybeSingle();
    if (!before) throw new Error("This account has no KYC submission to override.");
    const now = new Date().toISOString();
    const patch =
      data.level === 1
        ? { status: data.status, admin_note: data.reason, reviewed_by: context.userId, reviewed_at: now }
        : { level2_status: data.status, level2_admin_note: data.reason, level2_reviewed_by: context.userId, level2_reviewed_at: now };
    const { error } = await db.from("kyc_submissions").update(patch).eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await db.from("notifications").insert({
      user_id: data.userId,
      title: `Verification Level ${data.level} updated`,
      body: `Your Level ${data.level} verification status is now ${data.status}.${data.status === "rejected" ? ` Reason: ${data.reason}` : ""}`,
      kind: data.status === "approved" ? "success" : data.status === "rejected" ? "warning" : "info",
    });
    await logAudit(db, context.userId, "kyc.manual_override", data.userId, {
      level: data.level,
      before: data.level === 1 ? before.status : before.level2_status,
      after: data.status,
      reason: data.reason,
    });
    return { ok: true };
  });

/** Resolve a delayed deposit by its transaction hash: approve and credit the matching pending record. */
export const forceMatchDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ txHash: z.string().trim().min(10).max(200), reason: z.string().trim().min(5).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { data: rows } = await db.from("deposits").select("id,user_id,coin,network,amount,status").ilike("tx_hash", data.txHash);
    const list = (rows ?? []) as any[];
    if (list.length === 0) throw new Error("No deposit submission carries this transaction hash.");
    const dep = list.find((r) => r.status === "pending");
    if (!dep) throw new Error(`This hash is already ${list[0].status}.`);
    const { data: r, error } = await db.rpc("settle_deposit_atomic", {
      p_id: dep.id, p_status: "approved", p_note: `Force-matched on-chain: ${data.reason}`, p_reviewer: context.userId,
    });
    if (error || !r?.settled) throw new Error(error?.message ?? "Deposit was settled by another operator.");
    await db.from("notifications").insert({
      user_id: dep.user_id, title: "Deposit credited",
      body: `${Number(dep.amount)} ${dep.coin} (${dep.network}) has been credited to your balance.`, kind: "success",
    });
    await logAudit(db, context.userId, "deposit.force_match", dep.user_id, { deposit_id: dep.id, tx_hash: data.txHash, amount: Number(dep.amount), coin: dep.coin, reason: data.reason });
    return { ok: true, amount: Number(dep.amount), coin: dep.coin };
  });

/** Risk flags for pending withdrawals plus treasury liquidity (finance roles only). */
export const getWithdrawalRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const roles = await myRoles(context);
    const canFinance = roles.includes("admin") || roles.includes("finance");
    const db = await privileged();
    const { data: pending } = await db.from("withdrawals").select("id,user_id,coin,amount,destination_address,created_at").eq("status", "pending").limit(200);
    const rows = (pending ?? []) as any[];
    const users = [...new Set(rows.map((r) => r.user_id))];
    const since = new Date(Date.now() - 86_400_000).toISOString();
    const [history, limits, kyc, settings, treasury] = await Promise.all([
      users.length ? db.from("withdrawals").select("user_id,destination_address,status,amount,coin,created_at").in("user_id", users).limit(5000) : { data: [] },
      users.length ? db.from("user_withdrawal_limits").select("user_id,daily_limit_usdt").in("user_id", users) : { data: [] },
      users.length ? db.from("kyc_submissions").select("user_id,status").in("user_id", users) : { data: [] },
      db.from("platform_settings").select("key,value").in("key", ["payments", "vip_perks"]),
      canFinance ? db.from("treasury_wallets").select("currency,balance").order("currency") : { data: null },
    ]);
    const s = Object.fromEntries(((settings.data ?? []) as any[]).map((r) => [r.key, r.value ?? {}]));
    const pay = s["payments"] ?? {};
    const perks = s["vip_perks"] ?? {};
    const limitMap = new Map(((limits.data ?? []) as any[]).map((l) => [l.user_id, Number(l.daily_limit_usdt)]));
    const kycMap = new Map(((kyc.data ?? []) as any[]).map((k) => [k.user_id, k.status]));
    const hist = (history.data ?? []) as any[];
    const flags: Record<string, { newAddress: boolean; overDaily: boolean; dailyLimit: number | null; priority: boolean }> = {};
    for (const w of rows) {
      const prior = hist.some((h) => h.user_id === w.user_id && h.status === "approved" && h.destination_address === w.destination_address);
      const verified = kycMap.get(w.user_id) === "approved";
      const vip = !!perks[w.user_id]?.priorityWithdrawals;
      const limit = limitMap.get(w.user_id) ?? (vip ? pay.vipDailyWithdrawalLimit : verified ? pay.tier1DailyWithdrawalLimit : pay.unverifiedDailyLimit) ?? null;
      const dayTotal = hist
        .filter((h) => h.user_id === w.user_id && h.status !== "rejected" && h.created_at >= since && STABLE.has(String(h.coin).toUpperCase()))
        .reduce((a, h) => a + Number(h.amount), 0);
      flags[w.id] = {
        newAddress: !prior,
        overDaily: limit != null && STABLE.has(String(w.coin).toUpperCase()) && dayTotal > Number(limit),
        dailyLimit: limit != null ? Number(limit) : null,
        priority: vip,
      };
    }
    return { flags, treasury: treasury.data as { currency: string; balance: number }[] | null };
  });

/** Custom per-account VIP perks (fee discounts, leverage ceiling, priority withdrawals). */
export const getVipPerks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data } = await db.from("platform_settings").select("value").eq("key", "vip_perks").maybeSingle();
    return (data?.value ?? {}) as Record<string, any>;
  });

export const setVipPerk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      userId: z.string().uuid(),
      makerDiscountPct: z.number().min(0).max(100).nullable(),
      takerDiscountPct: z.number().min(0).max(100).nullable(),
      maxLeverage: z.number().int().min(1).max(500).nullable(),
      priorityWithdrawals: z.boolean(),
      reason: z.string().trim().min(5).max(400),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { data: row } = await db.from("platform_settings").select("value").eq("key", "vip_perks").maybeSingle();
    const all = { ...((row?.value as Record<string, any>) ?? {}) };
    const before = all[data.userId] ?? null;
    const { userId, reason, ...perk } = data;
    all[userId] = { ...perk, updatedAt: new Date().toISOString(), updatedBy: context.userId };
    const { error } = await db.from("platform_settings").upsert({ key: "vip_perks", value: all }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "vip.custom_perk", userId, { before, after: all[userId], reason });
    return { ok: true };
  });
