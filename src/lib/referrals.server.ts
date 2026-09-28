/** Server-only referral reward engine. */
import { privileged } from "@/lib/desk.server";

export const DEFAULT_REFERRAL_REWARD = 10;
export const REFERRAL_SETTINGS_KEY = "referrals";

export type ReferralSettings = { autoApprove: boolean; rewardAmount: number };

export async function readReferralSettings(): Promise<ReferralSettings> {
  const db = await privileged();
  const { data } = await db
    .from("platform_settings")
    .select("value")
    .eq("key", REFERRAL_SETTINGS_KEY)
    .maybeSingle();
  const value = (data?.value ?? {}) as Partial<ReferralSettings>;
  return {
    autoApprove: value.autoApprove ?? true,
    rewardAmount: Number(value.rewardAmount ?? DEFAULT_REFERRAL_REWARD),
  };
}

/**
 * Credits the referrer's USDT wallet for a referral and records the payout in
 * the user's transaction history. Safe to call more than once - a referral that
 * is already rewarded is skipped.
 */
export async function payReferralReward(
  referralId: string,
  actorId: string | null,
  overrideAmount?: number,
) {
  const db = await privileged();
  const { data: referral } = await db
    .from("referrals")
    .select("*")
    .eq("id", referralId)
    .maybeSingle();
  if (!referral) throw new Error("Referral not found.");
  if (referral.status === "rewarded") return { alreadyRewarded: true, amount: 0 };

  const settings = await readReferralSettings();
  const amount = Number(
    overrideAmount ?? referral.reward_amount ?? settings.rewardAmount ?? DEFAULT_REFERRAL_REWARD,
  );

  const { data: wallet } = await db
    .from("wallets")
    .select("*")
    .eq("user_id", referral.referrer_id)
    .eq("currency", "USDT")
    .maybeSingle();

  const next = Number(wallet?.balance ?? 0) + amount;
  if (wallet) {
    await db
      .from("wallets")
      .update({ balance: next, updated_at: new Date().toISOString() })
      .eq("id", wallet.id);
  } else {
    await db
      .from("wallets")
      .insert({ user_id: referral.referrer_id, currency: "USDT", balance: next });
  }

  // Ledger entry so the payout shows up in the member's transaction history.
  await db.from("deposits").insert({
    user_id: referral.referrer_id,
    coin: "USDT",
    network: "Referral reward",
    amount,
    status: "approved",
    admin_note: `Referral Bonus (+${amount} USDT)`,
    reviewed_by: actorId,
    reviewed_at: new Date().toISOString(),
  });

  const { data: profile } = await db
    .from("profiles")
    .select("referral_rewards_usdt")
    .eq("id", referral.referrer_id)
    .maybeSingle();
  await db
    .from("profiles")
    .update({ referral_rewards_usdt: Number(profile?.referral_rewards_usdt ?? 0) + amount })
    .eq("id", referral.referrer_id);

  await db
    .from("referrals")
    .update({
      status: "rewarded",
      reward_amount: amount,
      rewarded_at: new Date().toISOString(),
      reviewed_by: actorId,
    })
    .eq("id", referral.id);

  await db.from("notifications").insert({
    user_id: referral.referrer_id,
    title: "Referral bonus credited",
    body: `Referral Bonus (+${amount} USDT) has been added to your USDT wallet.`,
    kind: "success",
  });

  return { alreadyRewarded: false, amount };
}

/**
 * Called when a member completes identity verification: settles the referral
 * that introduced them, either instantly or by queueing it for admin approval.
 */
export async function settleReferralOnKyc(refereeId: string, actorId: string | null) {
  const db = await privileged();
  const { data: referral } = await db
    .from("referrals")
    .select("id,status")
    .eq("referee_id", refereeId)
    .maybeSingle();
  if (!referral || referral.status === "rewarded" || referral.status === "rejected") return;

  const settings = await readReferralSettings();
  if (settings.autoApprove) {
    await payReferralReward(referral.id, actorId);
  } else {
    await db.from("referrals").update({ status: "approved" }).eq("id", referral.id);
  }
}
