import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Member view: referral code, link stats and the people they introduced. */
export const getMyReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { privileged } = await import("@/lib/desk.server");
    const { readReferralSettings } = await import("@/lib/referrals.server");
    const db = await privileged();

    const [{ data: profile }, { data: rows }, settings] = await Promise.all([
      db.from("profiles").select("referral_code,uid").eq("id", userId).maybeSingle(),
      db
        .from("referrals")
        .select("*")
        .eq("referrer_id", userId)
        .order("created_at", { ascending: false })
        .limit(200),
      readReferralSettings(),
    ]);

    const referrals = (rows ?? []) as any[];
    const refereeIds = referrals.map((r) => r.referee_id);
    let names = new Map<string, { name: string; joinedAt: string | null }>();
    if (refereeIds.length) {
      const { data: people } = await db
        .from("profiles")
        .select("id,display_name,created_at")
        .in("id", refereeIds);
      names = new Map(
        (people ?? []).map((p: any) => [
          p.id,
          { name: p.display_name ?? "Trader", joinedAt: p.created_at },
        ]),
      );
    }

    const list = referrals.map((r) => ({
      id: r.id,
      status: r.status as string,
      rewardAmount: Number(r.reward_amount ?? 0),
      createdAt: r.created_at,
      rewardedAt: r.rewarded_at,
      refereeName: names.get(r.referee_id)?.name ?? "Trader",
    }));

    return {
      code: (profile as any)?.referral_code ?? (profile as any)?.uid ?? null,
      rewardAmount: settings.rewardAmount,
      stats: {
        invited: list.length,
        pending: list.filter((r) => r.status === "pending" || r.status === "approved").length,
        pendingRewards: list
          .filter((r) => r.status === "pending" || r.status === "approved")
          .reduce((s, r) => s + r.rewardAmount, 0),
        earned: list
          .filter((r) => r.status === "rewarded")
          .reduce((s, r) => s + r.rewardAmount, 0),
      },
      referrals: list,
    };
  });

/** Admin view: every referral on the platform with both parties resolved. */
export const adminListReferrals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertFinance, privileged } = await import("@/lib/desk.server");
    await assertFinance(context);
    const { readReferralSettings } = await import("@/lib/referrals.server");
    const db = await privileged();

    const [{ data: rows }, settings] = await Promise.all([
      db.from("referrals").select("*").order("created_at", { ascending: false }).limit(500),
      readReferralSettings(),
    ]);
    const referrals = (rows ?? []) as any[];
    const ids = Array.from(
      new Set(referrals.flatMap((r) => [r.referrer_id, r.referee_id]).filter(Boolean)),
    );
    const { data: people } = ids.length
      ? await db.from("profiles").select("id,display_name,email,referral_code").in("id", ids)
      : { data: [] as any[] };
    const map = new Map<string, any>((people ?? []).map((p: any) => [p.id, p]));

    return {
      settings,
      rows: referrals.map((r) => {
        const referrer = map.get(r.referrer_id);
        const referee = map.get(r.referee_id);
        return {
          id: r.id,
          status: r.status as string,
          rewardAmount: Number(r.reward_amount ?? 0),
          code: r.referral_code ?? referrer?.referral_code ?? null,
          note: r.admin_note ?? null,
          createdAt: r.created_at,
          rewardedAt: r.rewarded_at,
          referrerId: r.referrer_id,
          referrerName: referrer?.display_name ?? "Unknown",
          referrerEmail: referrer?.email ?? null,
          refereeId: r.referee_id,
          refereeName: referee?.display_name ?? "Unknown",
          refereeEmail: referee?.email ?? null,
        };
      }),
    };
  });

/** Grant or reject a single referral reward. */
export const reviewReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        action: z.enum(["grant", "reject"]),
        note: z.string().trim().max(400).optional(),
        amount: z.number().positive().max(100000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertFinance, privileged, logAudit } = await import("@/lib/desk.server");
    await assertFinance(context);
    const db = await privileged();

    if (data.action === "grant") {
      const { payReferralReward } = await import("@/lib/referrals.server");
      const result = await payReferralReward(data.id, context.userId, data.amount);
      if (data.note) await db.from("referrals").update({ admin_note: data.note }).eq("id", data.id);
      await logAudit(db, context.userId, "referral.grant", null, {
        referral_id: data.id,
        amount: result.amount,
      });
      return { ok: true, ...result };
    }

    const { data: row } = await db
      .from("referrals")
      .update({
        status: "rejected",
        admin_note: data.note ?? null,
        reviewed_by: context.userId,
      })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (row) {
      await db.from("notifications").insert({
        user_id: row.referrer_id,
        title: "Referral not eligible",
        body: data.note ?? "One of your referrals was reviewed and found ineligible for a reward.",
        kind: "warning",
      });
    }
    await logAudit(db, context.userId, "referral.reject", null, {
      referral_id: data.id,
      note: data.note ?? null,
    });
    return { ok: true };
  });

/** Global automatic-vs-manual approval switch and default reward size. */
export const saveReferralSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ autoApprove: z.boolean(), rewardAmount: z.number().positive().max(100000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, privileged, logAudit } = await import("@/lib/desk.server");
    await assertAdmin(context);
    const db = await privileged();
    const { REFERRAL_SETTINGS_KEY } = await import("@/lib/referrals.server");
    const { error } = await db
      .from("platform_settings")
      .upsert({ key: REFERRAL_SETTINGS_KEY, value: data }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "settings.update", null, { key: REFERRAL_SETTINGS_KEY });
    return { ok: true };
  });
