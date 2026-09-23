import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const profileInput = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  avatarUrl: z.string().trim().url().max(500).nullable().optional(),
});

/** A display name may only be changed once every 60 days. */
const NAME_COOLDOWN_MS = 60 * 24 * 60 * 60 * 1000;

function startOfTodayIso() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export const getProfileOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const { usdtRates } = await import("./rates.server");
    const claimRecord = claims as Record<string, unknown>;
    const userMetadata = (claimRecord["user_metadata"] ?? {}) as Record<string, unknown>;

    const [{ data: profile }, { data: wallets }, { data: contracts }, { data: positions }, { data: deposits }, rates] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("wallets").select("*").eq("user_id", userId).order("currency"),
        supabase.from("contracts").select("*").eq("user_id", userId),
        supabase.from("positions").select("*").eq("user_id", userId),
        supabase.from("deposits").select("*").eq("user_id", userId).eq("status", "pending"),
        usdtRates(),
      ]);

    const walletRows = (wallets ?? []).map((w) => ({
      currency: w.currency,
      balance: Number(w.balance),
      valueUsdt: Number(w.balance) * (rates[w.currency] ?? 0),
    }));
    const spotUsdt = walletRows.reduce((s, w) => s + w.valueUsdt, 0);

    const openContracts = (contracts ?? []).filter((c) => c.status === "open");
    const openPositions = (positions ?? []).filter((p) => p.status === "open");
    const leveragedPositions = openPositions.filter((p) => Number(p.leverage) > 1);
    const marginUsedUsdt = leveragedPositions.reduce((sum, position) => {
      const currencyRate = rates[position.currency];
      if (currencyRate === undefined) return sum;
      const margin =
        (Number(position.quantity) * Number(position.entry_price)) /
        Math.max(Number(position.leverage), 1);
      return sum + margin * currencyRate;
    }, 0);
    const futuresUsdt =
      openContracts.reduce((s, c) => s + Number(c.stake), 0) +
      openPositions.reduce(
        (s, p) =>
          s +
          (Number(p.quantity) * Number(p.entry_price) * (rates[p.currency] ?? 1)) /
            Math.max(Number(p.leverage) || 1, 1),
        0,
      );

    const fundingUsdt = (deposits ?? []).reduce(
      (s, d) => s + Number(d.amount) * (rates[d.coin] ?? 0),
      0,
    );

    const today = startOfTodayIso();
    const contractPnl = (c: (typeof openContracts)[number]) =>
      Number(c.payout ?? 0) - Number(c.stake);
    const settled = (contracts ?? []).filter((c) => c.status !== "open" && c.settled_at);
    const closedPositions = (positions ?? []).filter((p) => p.status === "closed");

    const totalPnl =
      settled.reduce((s, c) => s + contractPnl(c), 0) +
      closedPositions.reduce((s, p) => s + Number(p.realized_pnl ?? 0), 0);

    const todayPnl =
      settled
        .filter((c) => (c.settled_at ?? "") >= today)
        .reduce((s, c) => s + contractPnl(c), 0) +
      closedPositions
        .filter((p) => (p.closed_at ?? "") >= today)
        .reduce((s, p) => s + Number(p.realized_pnl ?? 0), 0);

    // Counting other people's rows requires elevated read; only a count is exposed.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await (supabaseAdmin as any)
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("referred_by", userId);

    const totalUsdt = spotUsdt + futuresUsdt + fundingUsdt;

    // ---- Risk & exposure (derived only from live account rows) ----
    const positionNotional = (p: (typeof openPositions)[number]) =>
      Number(p.quantity) * Number(p.entry_price) * (rates[p.currency] ?? 0);

    const exposureUsdt =
      openPositions.reduce((s, p) => s + positionNotional(p), 0) +
      openContracts.reduce((s, c) => s + Number(c.stake) * (rates[c.currency] ?? 1), 0);
    const equityUsdt = spotUsdt + marginUsedUsdt;
    const maxLeverage = openPositions.reduce((m, p) => Math.max(m, Number(p.leverage) || 1), 0);

    const hasMargin = leveragedPositions.length > 0;
    const marginAvailableUsdt = spotUsdt;
    const utilizationPct =
      hasMargin && marginUsedUsdt + marginAvailableUsdt > 0
        ? (marginUsedUsdt / (marginUsedUsdt + marginAvailableUsdt)) * 100
        : null;

    // ---- Execution sync (measured order latency & fill rate) ----
    const { summarizeExecutions } = await import("./execution.server");
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data: execRows } = await (supabaseAdmin as any)
      .from("trade_executions")
      .select("fill_latency_ms, requested_qty, filled_qty, status")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);
    const execution = summarizeExecutions(execRows ?? []);

    // Account Health = margin risk / liquidation safety only. 100% with no exposure.
    const healthPct =
      utilizationPct === null ? 100 : Math.max(0, Math.min(100, 100 - utilizationPct));

    const exposureRisk: "low" | "moderate" | "high" | null =
      utilizationPct !== null
        ? utilizationPct >= 60
          ? "high"
          : utilizationPct >= 30
            ? "moderate"
            : "low"
        : exposureUsdt > 0 && equityUsdt > 0
          ? exposureUsdt / equityUsdt >= 3
            ? "high"
            : exposureUsdt / equityUsdt >= 1
              ? "moderate"
              : "low"
          : null;

    const accountHealth = {
      status: (healthPct < 40 ? "at_risk" : healthPct < 70 ? "caution" : "healthy") as
        | "healthy"
        | "caution"
        | "at_risk",
      pct: Math.round(healthPct * 10) / 10 as number | null,
      hasExposure: utilizationPct !== null,
    };

    // ---- Trader Trust Score (milestone based; formula not exposed to the UI) ----
    const [{ data: kycRow }, { data: securityRow }, { count: depositCount }] = await Promise.all([
      (supabaseAdmin as any)
        .from("kyc_submissions")
        .select("status, level2_status")
        .eq("user_id", userId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("user_security")
        .select("two_factor_enabled")
        .eq("user_id", userId)
        .maybeSingle(),
      (supabaseAdmin as any)
        .from("deposits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "approved"),
    ]);

    const profitableTrades =
      settled.filter((c) => contractPnl(c) > 0).length +
      closedPositions.filter((p) => Number(p.realized_pnl ?? 0) > 0).length;

    let trustScore = 0;
    if (kycRow?.status === "approved") trustScore += 5;
    if ((kycRow as any)?.level2_status === "approved") trustScore += 5;
    if (securityRow?.two_factor_enabled) trustScore += 5;
    if ((depositCount ?? 0) > 0) trustScore += 5;
    if (profitableTrades > 0) trustScore += 3 + Math.max(0, profitableTrades - 1) * 2;

    const trustCap = spotUsdt > 5000 ? 100 : 50;
    const traderTrustScore = Math.max(0, Math.min(trustCap, Math.round(trustScore)));


    // ---- Monthly eligible trading volume ----
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const monthStartIso = monthStart.toISOString();

    const monthContracts = settled.filter((c) => (c.settled_at ?? "") >= monthStartIso);
    const monthPositions = closedPositions.filter((p) => (p.closed_at ?? "") >= monthStartIso);
    const monthVolumeUsdt =
      monthContracts.reduce((s, c) => s + Number(c.stake) * (rates[c.currency] ?? 1), 0) +
      monthPositions.reduce(
        (s, p) => s + Number(p.quantity) * Number(p.entry_price) * (rates[p.currency] ?? 0),
        0,
      );
    const monthTradeCount = monthContracts.length + monthPositions.length;

    const { parseTradingTiers, resolveTier } = await import("./trading-tiers");
    const { data: tierSetting } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("value")
      .eq("key", "trading_tiers")
      .maybeSingle();
    const tiers = parseTradingTiers(tierSetting?.value);
    const tierResult = resolveTier(monthVolumeUsdt, tiers);

    return {
      profile: {
        id: userId,
        uid: (profile as any)?.uid ?? null,
        displayName: profile?.display_name ?? "Trader",
        avatarUrl: (profile as any)?.avatar_url ?? null,
        email: (claimRecord["email"] as string | undefined) ?? null,
        emailVerified: Boolean(claimRecord["email_verified"] ?? userMetadata["email_verified"]),
        phone: (claimRecord["phone"] as string | undefined) ?? null,
        referralCode: (profile as any)?.referral_code ?? null,
        referralRewards: Number((profile as any)?.referral_rewards_usdt ?? 0),
        vipTier: ((profile as any)?.vip_tier ?? "regular") as string,
        vipUpgradedAt: (profile as any)?.vip_upgraded_at ?? null,
        createdAt: profile?.created_at ?? null,
        nameUpdatedAt: (profile as any)?.display_name_updated_at ?? null,
        nameLockedUntil: (profile as any)?.display_name_updated_at
          ? new Date(
              new Date((profile as any).display_name_updated_at).getTime() + NAME_COOLDOWN_MS,
            ).toISOString()
          : null,
      },
      balances: {
        totalUsdt,
        spotUsdt,
        futuresUsdt,
        fundingUsdt,
        wallets: walletRows,
      },
      metrics: {
        todayPnl,
        totalPnl,
        todayPnlPct: totalUsdt > 0 ? (todayPnl / totalUsdt) * 100 : 0,
        openContracts: openContracts.length,
        openPositions: openPositions.length,
      },
      risk: {
        accountHealth,
        exposure: {
          notionalUsdt: exposureUsdt,
          equityUsdt,
          leverageMax: maxLeverage,
          risk: exposureRisk,
        },
        margin: hasMargin
          ? {
              usedUsdt: marginUsedUsdt,
              availableUsdt: marginAvailableUsdt,
              utilizationPct: utilizationPct,
              availablePct: utilizationPct === null ? null : 100 - utilizationPct,
              openPositions: leveragedPositions.length,
            }
          : null,
        execution,
      },
      volume: {
        monthUsdt: monthVolumeUsdt,
        tradeCount: monthTradeCount,
        tier: tierResult.current,
        nextTier: tierResult.next,
        progressPct: tierResult.progressPct,
        tiers,
      },
      referrals: {
        invited: count ?? 0,
        rewards: Number((profile as any)?.referral_rewards_usdt ?? 0),
      },
    };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => profileInput.parse(input))
  .handler(async ({ data, context }) => {
    const patch: {
      display_name?: string;
      avatar_url?: string | null;
      display_name_updated_at?: string;
    } = {};

    if (data.displayName !== undefined) {
      const { data: current } = await context.supabase
        .from("profiles")
        .select("display_name, display_name_updated_at")
        .eq("id", context.userId)
        .maybeSingle();

      const changed = (current as any)?.display_name !== data.displayName;
      const last = (current as any)?.display_name_updated_at;
      if (changed && last) {
        const unlocksAt = new Date(last).getTime() + NAME_COOLDOWN_MS;
        if (unlocksAt > Date.now()) {
          const days = Math.ceil((unlocksAt - Date.now()) / 86_400_000);
          throw new Error(
            `Your name can only be changed once every 60 days. Try again in ${days} day${days === 1 ? "" : "s"}.`,
          );
        }
      }
      if (changed) {
        patch.display_name = data.displayName;
        patch.display_name_updated_at = new Date().toISOString();
      }
    }
    if (data.avatarUrl !== undefined) patch.avatar_url = data.avatarUrl;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await context.supabase
      .from("profiles")
      .update(patch)
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
