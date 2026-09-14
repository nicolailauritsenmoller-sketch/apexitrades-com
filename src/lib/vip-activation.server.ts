import { VIP1_THRESHOLD_USDT } from "./vip-tiers";

/**
 * Promotes a user to VIP 1 once their total wallet value reaches the threshold.
 * Called right after a deposit is credited. Safe to call repeatedly — it exits
 * early when the account is already on a VIP tier.
 */
export async function maybeActivateVip(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: profile } = await db
    .from("profiles")
    .select("id, vip_tier, display_name, email")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || (profile.vip_tier ?? "regular") !== "regular") return { upgraded: false };

  const { usdtRates } = await import("./rates.server");
  const [{ data: wallets }, rates] = await Promise.all([
    db.from("wallets").select("currency, balance").eq("user_id", userId),
    usdtRates(),
  ]);

  const totalUsdt = (wallets ?? []).reduce(
    (sum: number, w: any) => sum + Number(w.balance) * ((rates as any)[w.currency] ?? 0),
    0,
  );
  if (totalUsdt < VIP1_THRESHOLD_USDT) return { upgraded: false };

  await db
    .from("profiles")
    .update({ vip_tier: "vip1", vip_upgraded_at: new Date().toISOString() })
    .eq("id", userId);

  await db.from("notifications").insert({
    user_id: userId,
    title: "VIP 1 activated",
    body: "Congratulations! Your account has been upgraded to VIP 1 status.",
    kind: "success",
  });

  if (profile.email) {
    try {
      const { sendTemplateEmail } = await import("./email-templates/send-email");
      await sendTemplateEmail("vip-welcome", profile.email, {
        templateData: {
          siteName: "Velocity Trade",
          displayName: profile.display_name ?? undefined,
          amount: `${VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT`,
          tierLabel: "VIP 1",
        },
        idempotencyKey: `vip-welcome-${userId}`,
      });
    } catch {
      // Email delivery must never block the upgrade itself.
    }
  }

  return { upgraded: true };
}
