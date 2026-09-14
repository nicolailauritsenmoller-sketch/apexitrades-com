import { VIP1_THRESHOLD_USDT } from "./vip-tiers";

/**
 * Flags a VIP upgrade request once a cleared deposit takes the account to the
 * VIP threshold. Activation itself is manual: an admin approves or rejects the
 * request from the user management console. Safe to call repeatedly.
 */
export async function maybeFlagVipRequest(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = supabaseAdmin as any;

  const { data: profile } = await db
    .from("profiles")
    .select("id, vip_tier, display_name, uid, email")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || (profile.vip_tier ?? "regular") !== "regular") return { flagged: false };

  const { usdtRates } = await import("./rates.server");
  const [{ data: wallets }, rates] = await Promise.all([
    db.from("wallets").select("currency, balance").eq("user_id", userId),
    usdtRates(),
  ]);

  const totalUsdt = (wallets ?? []).reduce(
    (sum: number, w: any) => sum + Number(w.balance) * ((rates as any)[w.currency] ?? 0),
    0,
  );
  if (totalUsdt < VIP1_THRESHOLD_USDT) return { flagged: false };

  await db.from("profiles").update({ vip_tier: "vip_pending" }).eq("id", userId);

  await db.from("notifications").insert({
    user_id: userId,
    title: "VIP upgrade under review",
    body: `Your balance qualifies for VIP 1. Your upgrade request is pending review and you will be notified once it is approved.`,
    kind: "info",
  });

  // Alert every admin so the request surfaces in their notification centre.
  const { data: admins } = await db.from("user_roles").select("user_id").eq("role", "admin");
  const rows = (admins ?? []).map((a: any) => ({
    user_id: a.user_id,
    title: "VIP membership request",
    body: `${profile.display_name ?? "A user"}${profile.uid ? ` (ID ${profile.uid})` : ""} reached ${VIP1_THRESHOLD_USDT.toLocaleString("en-US")} USDT and is awaiting VIP approval.`,
    kind: "warning",
  }));
  if (rows.length) await db.from("notifications").insert(rows);

  return { flagged: true };
}
