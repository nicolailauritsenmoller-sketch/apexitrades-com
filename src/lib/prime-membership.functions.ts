import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPrimeMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { usdtRates } = await import("./rates.server");
    const [profile, wallets, account, schedule, rates] = await Promise.all([
      context.supabase.from("profiles").select("vip_tier").eq("id", context.userId).single(),
      context.supabase.from("wallets").select("currency,balance").eq("user_id", context.userId),
      context.supabase.from("vip_accounts").select("level,recommended_level,account_manager_name,account_manager_email,evaluated_at,grace_until").eq("user_id", context.userId).maybeSingle(),
      context.supabase.rpc("get_prime_fee_schedule"),
      usdtRates(),
    ]);
    for (const result of [profile, wallets, account, schedule]) {
      if (result.error) throw new Error("Membership status could not be refreshed. Please retry.");
    }
    const missingRates = (wallets.data ?? []).some(w => Number(w.balance) > 0 && rates[w.currency] === undefined);
    const clearedBalance = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.balance) * (rates[w.currency] ?? 0), 0);
    return {
      userId: context.userId,
      status: profile.data?.vip_tier ?? "regular",
      clearedBalance,
      valuationComplete: !missingRates,
      account: account.data,
      schedule: schedule.data ?? [],
    };
  });

/** Submit a non-executing upgrade recommendation; only staff can activate a level. */
export const requestPrimeAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ level: z.number().int().min(1).max(4) }).parse(input))
  .handler(async ({ context, data }) => {
    const { usdtRates } = await import("./rates.server");
    const [wallets, schedule, rates] = await Promise.all([
      context.supabase.from("wallets").select("currency,balance").eq("user_id", context.userId),
      context.supabase.rpc("get_prime_fee_schedule"),
      usdtRates(),
    ]);
    if (wallets.error || schedule.error) throw new Error("Unable to evaluate collateral. Please retry.");
    if ((wallets.data ?? []).some(w => Number(w.balance) > 0 && rates[w.currency] === undefined)) throw new Error("Collateral valuation is temporarily unavailable.");
    const balance = (wallets.data ?? []).reduce((sum, w) => sum + Number(w.balance) * (rates[w.currency] ?? 0), 0);
    const target = schedule.data?.find(t => t.level === data.level);
    if (!target || Number(target.min_portfolio_usdt) <= 0 || balance < Number(target.min_portfolio_usdt)) throw new Error("Minimum collateral requirement has not been met.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("request_prime_allocation", { p_user_id: context.userId, p_level: data.level });
    if (error) throw new Error("Allocation request could not be submitted. Please refresh and retry.");
    return { status: String(result) };
  });