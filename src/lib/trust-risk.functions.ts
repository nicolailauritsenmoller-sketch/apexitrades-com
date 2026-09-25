import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit, privileged } from "./desk.server";

export type TrustRiskRow = {
  id: string;
  displayName: string;
  email: string | null;
  uid: string | null;
  trustPct: number;
  computedTrustPct: number;
  overridePct: number | null;
  healthPct: number;
  hasExposure: boolean;
  milestones: {
    kyc: boolean;
    enhancedKyc: boolean;
    twoFactor: boolean;
    deposit: boolean;
    profitableTrades: number;
    balanceUnlocked: boolean;
  };
  tradingFrozen: boolean;
  marginRestricted: boolean;
  verificationRequired: boolean;
};

export const getTrustRiskDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TrustRiskRow[]> => {
    await assertAdmin(context);
    const db = await privileged();
    const { usdtRates } = await import("./rates.server");
    const [profiles, kyc, sec, deps, contracts, positions, wallets, rates] = await Promise.all([
      db
        .from("profiles")
        .select(
          "id,display_name,email,uid,trader_trust_score,trust_score_override,trading_frozen,margin_restricted,verification_required",
        )
        .order("created_at", { ascending: false })
        .limit(1000),
      db.from("kyc_submissions").select("user_id,status,level2_status"),
      db.from("user_security").select("user_id,two_factor_enabled"),
      db.from("deposits").select("user_id").eq("status", "approved"),
      db.from("contracts").select("user_id,status,settled_at,payout,stake").neq("status", "open"),
      db.from("positions").select("user_id,status,realized_pnl,quantity,entry_price,leverage,currency"),
      db.from("wallets").select("user_id,currency,balance"),
      usdtRates(),
    ]);

    const by = (rows: any[] | null) => {
      const m = new Map<string, any[]>();
      for (const r of rows ?? []) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
      return m;
    };
    const kycM = by(kyc.data), secM = by(sec.data), depM = by(deps.data);
    const conM = by(contracts.data), posM = by(positions.data), walM = by(wallets.data);

    return (profiles.data ?? []).map((p: any) => {
      const k = kycM.get(p.id)?.[0];
      const pos = posM.get(p.id) ?? [];
      const wal = walM.get(p.id) ?? [];
      const wins =
        (conM.get(p.id) ?? []).filter((c: any) => c.settled_at && Number(c.payout ?? 0) - Number(c.stake) > 0).length +
        pos.filter((x: any) => x.status === "closed" && Number(x.realized_pnl ?? 0) > 0).length;
      const stableBal = wal
        .filter((w: any) => w.currency === "USDT" || w.currency === "USD")
        .reduce((s: number, w: any) => s + Number(w.balance), 0);
      const spotUsdt = wal.reduce((s: number, w: any) => s + Number(w.balance) * (rates[w.currency] ?? 0), 0);
      const used = pos
        .filter((x: any) => x.status === "open" && Number(x.leverage) > 1)
        .reduce(
          (s: number, x: any) =>
            s + ((Number(x.quantity) * Number(x.entry_price)) / Math.max(Number(x.leverage), 1)) * (rates[x.currency] ?? 0),
          0,
        );
      const hasExposure = used > 0;
      const util = hasExposure && used + spotUsdt > 0 ? (used / (used + spotUsdt)) * 100 : 0;
      const override = p.trust_score_override == null ? null : Number(p.trust_score_override);
      const computed = Number(p.trader_trust_score ?? 0);
      return {
        id: p.id,
        displayName: p.display_name,
        email: p.email,
        uid: p.uid,
        trustPct: override ?? computed,
        computedTrustPct: computed,
        overridePct: override,
        healthPct: Math.round(Math.max(0, 100 - util) * 10) / 10,
        hasExposure,
        milestones: {
          kyc: k?.status === "approved",
          enhancedKyc: k?.level2_status === "approved",
          twoFactor: Boolean(secM.get(p.id)?.[0]?.two_factor_enabled),
          deposit: (depM.get(p.id) ?? []).length > 0,
          profitableTrades: wins,
          balanceUnlocked: stableBal > 5000,
        },
        tradingFrozen: Boolean(p.trading_frozen),
        marginRestricted: Boolean(p.margin_restricted),
        verificationRequired: Boolean(p.verification_required),
      };
    });
  });

export const setTrustScoreOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        pct: z.number().min(0).max(100).nullable(),
        note: z.string().trim().max(300).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db
      .from("profiles")
      .update({ trust_score_override: data.pct === null ? null : Math.round(data.pct) })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "trust_score.override", data.userId, {
      pct: data.pct,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const setRiskControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        tradingFrozen: z.boolean().optional(),
        marginRestricted: z.boolean().optional(),
        verificationRequired: z.boolean().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const patch: Record<string, boolean> = {};
    if (data.tradingFrozen !== undefined) patch["trading_frozen"] = data.tradingFrozen;
    if (data.marginRestricted !== undefined) patch["margin_restricted"] = data.marginRestricted;
    if (data.verificationRequired !== undefined) patch["verification_required"] = data.verificationRequired;
    const { error } = await db.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "risk_controls.update", data.userId, patch);
    const labels: string[] = [];
    if (patch["trading_frozen"] !== undefined) labels.push(patch["trading_frozen"] ? "Trading frozen" : "Trading restored");
    if (patch["margin_restricted"] !== undefined) labels.push(patch["margin_restricted"] ? "Margin restricted" : "Margin restored");
    if (patch["verification_required"] !== undefined)
      labels.push(patch["verification_required"] ? "Additional verification required" : "Verification requirement cleared");
    await db.from("notifications").insert({
      user_id: data.userId,
      title: "Account controls updated",
      body: labels.join(" · "),
      kind: "warning",
    });
    return { ok: true };
  });
