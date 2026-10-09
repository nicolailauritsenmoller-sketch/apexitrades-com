/** Server-only VIP fee resolution and the rolling 30-day tier evaluation engine. */

export type FeeProduct = "spot" | "futures" | "scalp";
export type FeeSide = "maker" | "taker";

const DAY = 86_400_000;

export function productFor(assetClass: string, leverage: number): FeeProduct {
  return assetClass === "future" || leverage > 1 ? "futures" : "spot";
}

/** Effective fee rate in percent: custom override first, then the account's tier, then Standard. */
/** Custom per-account VIP perk (platform_settings key "vip_perks"). */
export async function loadVipPerk(userId: string): Promise<Record<string, any> | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("platform_settings").select("value").eq("key", "vip_perks").maybeSingle();
  return (data?.value as Record<string, any> | null)?.[userId] ?? null;
}

export async function resolveFeeRate(
  db: any,
  userId: string,
  product: FeeProduct,
  side: FeeSide = "taker",
): Promise<number> {
  const [base, perk] = await Promise.all([baseFeeRate(db, userId, product, side), loadVipPerk(userId)]);
  const pct = Number(perk?.[side === "maker" ? "makerDiscountPct" : "takerDiscountPct"] ?? 0);
  return pct > 0 ? base * (1 - Math.min(pct, 100) / 100) : base;
}

async function baseFeeRate(
  db: any,
  userId: string,
  product: FeeProduct,
  side: FeeSide = "taker",
): Promise<number> {
  const col = `${product}_${side}`;
  const [{ data: override }, { data: account }] = await Promise.all([
    db.from("user_fee_overrides").select(col).eq("user_id", userId).maybeSingle(),
    db.from("vip_accounts").select("level").eq("user_id", userId).maybeSingle(),
  ]);
  const o = override?.[col];
  if (o !== null && o !== undefined) return Number(o);
  const level = Number(account?.level ?? 0);
  const { data: tiers } = await db
    .from("vip_fee_tiers")
    .select(`level,${col}`)
    .lte("level", level)
    .order("level", { ascending: false })
    .limit(1);
  const r = tiers?.[0]?.[col];
  return r === null || r === undefined ? 0 : Number(r);
}

export function feeAmount(notional: number, ratePct: number) {
  return Math.round(((notional * ratePct) / 100) * 1e8) / 1e8;
}

type Tier = {
  level: number;
  name: string;
  min_spot_volume: number;
  min_futures_volume: number;
  min_scalp_volume: number;
  min_portfolio_usdt: number;
};

/** A tier qualifies when ANY configured criterion (> 0) is met. Level 0 always qualifies. */
export function qualifyingLevel(
  tiers: Tier[],
  m: { spot: number; futures: number; scalp: number; portfolio: number },
) {
  let best = 0;
  for (const t of tiers) {
    if (t.level === 0) continue;
    const checks: boolean[] = [];
    if (Number(t.min_spot_volume) > 0) checks.push(m.spot >= Number(t.min_spot_volume));
    if (Number(t.min_futures_volume) > 0) checks.push(m.futures >= Number(t.min_futures_volume));
    if (Number(t.min_scalp_volume) > 0) checks.push(m.scalp >= Number(t.min_scalp_volume));
    if (Number(t.min_portfolio_usdt) > 0) checks.push(m.portfolio >= Number(t.min_portfolio_usdt));
    if (checks.length && checks.some(Boolean) && t.level > best) best = t.level;
  }
  return best;
}

async function audit(db: any, actorId: string | null, action: string, target: string, details: Record<string, unknown>) {
  await db.from("admin_audit_logs").insert({
    actor_id: actorId ?? "00000000-0000-0000-0000-000000000000",
    actor_name: actorId ? null : "VIP engine (daily)",
    action,
    target_user_id: target,
    details,
  });
}

/**
 * Evaluates 30-day rolling volumes and holdings for every active account.
 * Upgrades are only recommended (admin approval); downgrades apply after the grace period.
 */
export async function evaluateVipLevels(db: any, actorId: string | null = null) {
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [{ data: tiers }, { data: grace }, { data: positions }, { data: contracts }, { data: accounts }] =
    await Promise.all([
      db.from("vip_fee_tiers").select("level,name,min_spot_volume,min_futures_volume,min_scalp_volume,min_portfolio_usdt").order("level"),
      db.from("platform_settings").select("value").eq("key", "vip_grace_days").maybeSingle(),
      db.from("positions").select("user_id,asset_class,leverage,quantity,entry_price,exit_price,status,opened_at,closed_at").gte("opened_at", since).limit(50000),
      db.from("contracts").select("user_id,stake").gte("opened_at", since).limit(50000),
      db.from("vip_accounts").select("user_id,level,grace_until,recommended_level"),
    ]);
  const graceDays = Math.max(0, Number(grace?.value ?? 14));

  const metrics = new Map<string, { spot: number; futures: number; scalp: number; portfolio: number }>();
  const get = (id: string) => {
    let m = metrics.get(id);
    if (!m) metrics.set(id, (m = { spot: 0, futures: 0, scalp: 0, portfolio: 0 }));
    return m;
  };
  for (const p of (positions ?? []) as any[]) {
    const q = Number(p.quantity);
    let vol = q * Number(p.entry_price);
    if (p.status === "closed" && p.exit_price) vol += q * Number(p.exit_price);
    get(p.user_id)[productFor(p.asset_class, Number(p.leverage))] += vol;
  }
  for (const c of (contracts ?? []) as any[]) get(c.user_id).scalp += Number(c.stake);
  for (const a of (accounts ?? []) as any[]) get(a.user_id);

  const ids = [...metrics.keys()];
  if (ids.length) {
    const { usdtRates } = await import("./rates.server");
    const [rates, { data: wallets }] = await Promise.all([
      usdtRates(),
      db.from("wallets").select("user_id,currency,balance").in("user_id", ids),
    ]);
    for (const w of (wallets ?? []) as any[]) {
      get(w.user_id).portfolio += Number(w.balance ?? 0) * ((rates as any)[w.currency] ?? 0);
    }
  }

  const accMap = new Map(((accounts ?? []) as any[]).map((a) => [a.user_id, a]));
  const now = new Date();
  let upgrades = 0;
  let downgrades = 0;
  let graceStarted = 0;

  for (const [userId, m] of metrics) {
    const acc = accMap.get(userId);
    const current = Number(acc?.level ?? 0);
    const qualifies = qualifyingLevel((tiers ?? []) as Tier[], m);
    const patch: Record<string, unknown> = {
      user_id: userId,
      spot_volume_30d: m.spot,
      futures_volume_30d: m.futures,
      scalp_volume_30d: m.scalp,
      portfolio_usdt: m.portfolio,
      evaluated_at: now.toISOString(),
      updated_at: now.toISOString(),
      recommended_level: qualifies > current ? qualifies : null,
    };
    if (qualifies > current && acc?.recommended_level !== qualifies) upgrades++;

    if (qualifies < current) {
      const until = acc?.grace_until ? new Date(acc.grace_until) : null;
      if (!until) {
        patch["grace_until"] = new Date(now.getTime() + graceDays * DAY).toISOString();
        graceStarted++;
        await audit(db, actorId, "vip.grace_started", userId, { from: current, qualifies, grace_days: graceDays });
      } else if (until <= now) {
        patch["level"] = qualifies;
        patch["grace_until"] = null;
        downgrades++;
        await audit(db, actorId, "vip.auto_downgrade", userId, { from: current, to: qualifies });
        if (qualifies === 0) {
          await db.from("profiles").update({ vip_tier: "regular", vip_upgraded_at: null }).eq("id", userId).eq("vip_tier", "vip1");
        }
        await db.from("notifications").insert({
          user_id: userId,
          title: "VIP status update",
          body: qualifies === 0
            ? "Your 30-day trading activity no longer meets VIP requirements. Your account is now on the Standard fee schedule."
            : "Your VIP fee schedule was adjusted to reflect your 30-day trading activity.",
          kind: "info",
        });
      }
    } else if (acc?.grace_until) {
      patch["grace_until"] = null;
      await audit(db, actorId, "vip.grace_cleared", userId, { level: current });
    }

    if (!acc && qualifies === 0) continue; // nothing to track yet
    await db.from("vip_accounts").upsert(patch);
  }

  return { evaluated: metrics.size, upgradeRecommendations: upgrades, downgrades, graceStarted, graceDays };
}
