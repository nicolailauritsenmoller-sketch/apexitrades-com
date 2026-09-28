import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";

/** FATF blacklist + selected increased-monitoring jurisdictions (ISO alpha-2 or names). */
const HIGH_RISK_COUNTRIES = new Set([
  "KP", "IR", "MM", "SY", "YE", "AF", "SS", "HT", "ML", "VE",
  "NORTH KOREA", "IRAN", "MYANMAR", "SYRIA", "YEMEN", "AFGHANISTAN",
  "SOUTH SUDAN", "HAITI", "MALI", "VENEZUELA",
]);

export type RiskCategory = "Low" | "Medium" | "High";

async function audit(
  db: any,
  actorId: string,
  action: string,
  targetUserId: string,
  details: Record<string, unknown>,
) {
  const { data: me } = await db.from("profiles").select("display_name").eq("id", actorId).maybeSingle();
  await db.from("admin_audit_logs").insert({
    actor_id: actorId,
    actor_name: me?.display_name ?? null,
    action,
    target_user_id: targetUserId,
    details,
  });
}

/** Risk category, tier, limit and audit trail for one account. */
export const getComplianceProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const since = new Date(Date.now() - 86_400_000).toISOString();

    const [kycQ, secQ, depQ, wdQ, limitQ, auditQ, profQ] = await Promise.all([
      db.from("kyc_submissions").select("status,level2_status,country").eq("user_id", data.userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("user_security").select("two_factor_enabled").eq("user_id", data.userId).maybeSingle(),
      db.from("deposits").select("id", { count: "exact", head: true }).eq("user_id", data.userId).gte("created_at", since),
      db.from("withdrawals").select("id", { count: "exact", head: true }).eq("user_id", data.userId).gte("created_at", since),
      db.from("user_withdrawal_limits").select("daily_limit_usdt,updated_at").eq("user_id", data.userId).maybeSingle(),
      db.from("admin_audit_logs").select("id,actor_id,actor_name,action,details,created_at")
        .eq("target_user_id", data.userId).order("created_at", { ascending: false }).limit(40),
      db.from("profiles").select("withdrawals_disabled").eq("id", data.userId).maybeSingle(),
    ]);

    const kyc = kycQ.data as any;
    const country = String(kyc?.country ?? "").trim().toUpperCase();
    const twoFa = Boolean((secQ.data as any)?.two_factor_enabled);
    const tier = kyc?.level2_status === "approved" ? 2 : kyc?.status === "approved" ? 1 : 0;
    const velocity = (depQ.count ?? 0) + (wdQ.count ?? 0);

    const factors: { label: string; points: number }[] = [];
    if (!country) factors.push({ label: "Country not declared", points: 1 });
    else if (HIGH_RISK_COUNTRIES.has(country)) factors.push({ label: `High-risk jurisdiction (${country})`, points: 3 });
    if (!twoFa) factors.push({ label: "2FA not enabled", points: 1 });
    if (tier === 0) factors.push({ label: "Identity not verified", points: 2 });
    else if (tier === 1) factors.push({ label: "Level 2 not completed", points: 1 });
    if (velocity >= 10) factors.push({ label: `High transaction velocity (${velocity} in 24h)`, points: 2 });
    else if (velocity >= 5) factors.push({ label: `Elevated transaction velocity (${velocity} in 24h)`, points: 1 });

    const score = factors.reduce((s, f) => s + f.points, 0);
    const category: RiskCategory = score >= 4 ? "High" : score >= 2 ? "Medium" : "Low";

    return {
      category,
      score,
      factors,
      tier,
      twoFactorEnabled: twoFa,
      country: country || null,
      velocity24h: velocity,
      withdrawalsDisabled: Boolean((profQ.data as any)?.withdrawals_disabled),
      dailyLimitUsdt: limitQ.data ? Number((limitQ.data as any).daily_limit_usdt) : null,
      audit: (auditQ.data ?? []) as any[],
    };
  });

/** Invalidates every verified 2FA session so the user must re-enter their code. */
export const forceTwoFactorReauth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: sec } = await db.from("user_security").select("two_factor_enabled").eq("user_id", data.userId).maybeSingle();
    if (!(sec as any)?.two_factor_enabled) {
      throw new Error("This user has not enabled 2FA - there is nothing to re-authenticate.");
    }
    await db.from("two_factor_sessions").delete().eq("user_id", data.userId);
    await db.from("security_logs").insert({
      user_id: data.userId,
      event: "2fa_reauth_forced",
      detail: "Compliance required a fresh two-factor verification.",
    });
    await db.from("notifications").insert({
      user_id: data.userId,
      title: "Two-factor verification required",
      body: "For your security, please confirm your authenticator code to continue.",
      kind: "warning",
    });
    await audit(db, context.userId, "compliance.force_2fa_reauth", data.userId, {});
    return { ok: true };
  });

/** Sets (or clears with null) the account's daily withdrawal limit in USDT. */
export const setDailyWithdrawalLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ userId: z.string().uuid(), limit: z.number().min(0).max(100_000_000).nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: prev } = await db.from("user_withdrawal_limits").select("daily_limit_usdt").eq("user_id", data.userId).maybeSingle();
    if (data.limit === null) {
      await db.from("user_withdrawal_limits").delete().eq("user_id", data.userId);
    } else {
      const { error } = await db.from("user_withdrawal_limits").upsert({
        user_id: data.userId,
        daily_limit_usdt: data.limit,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    }
    await audit(db, context.userId, "compliance.withdrawal_limit", data.userId, {
      from: prev ? Number((prev as any).daily_limit_usdt) : null,
      to: data.limit,
    });
    await db.from("notifications").insert({
      user_id: data.userId,
      title: "Withdrawal limit updated",
      body: data.limit === null
        ? "Your custom daily withdrawal limit was removed."
        : `Your daily withdrawal limit is now ${data.limit.toLocaleString()} USDT.`,
      kind: "info",
    });
    return { ok: true };
  });
