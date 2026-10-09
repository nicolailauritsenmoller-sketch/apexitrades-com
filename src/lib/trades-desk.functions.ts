import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myRoles, privileged, logAudit } from "@/lib/desk.server";

const PEGGED = new Set(["USDT", "USDC", "USD", "BUSD", "DAI"]);

async function assertDeskReader(context: { supabase: any; userId: string }) {
  const roles = await myRoles(context);
  if (!roles.some((r) => r === "admin" || r === "finance" || r === "agent")) {
    throw new Error("Forbidden: staff access required.");
  }
  return roles;
}

/** Unified contracts + positions feed with account, fee and audit context for the Trades desk. */
export const getTradesDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: z.string().optional(), to: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertDeskReader(context);
    const db = await privileged();
    const from = data.from ? new Date(data.from).toISOString() : new Date(Date.now() - 30 * 86400_000).toISOString();
    const to = data.to ? new Date(data.to).toISOString() : new Date(Date.now() + 86400_000).toISOString();

    const [contracts, positions, tiers, settings, audits] = await Promise.all([
      db.from("contracts").select("*").gte("opened_at", from).lte("opened_at", to).order("opened_at", { ascending: false }).limit(1500),
      db.from("positions").select("*").gte("opened_at", from).lte("opened_at", to).order("opened_at", { ascending: false }).limit(1500),
      db.from("vip_fee_tiers").select("*").order("level"),
      db.from("platform_settings").select("value").eq("key", "trading").maybeSingle(),
      db.from("admin_audit_logs").select("id,actor_name,action,details,created_at,target_user_id")
        .or("action.like.trade.%,action.like.contract.%,action.like.position.%")
        .order("created_at", { ascending: false }).limit(800),
    ]);

    const userIds = [...new Set([...(contracts.data ?? []), ...(positions.data ?? [])].map((r: any) => r.user_id))];
    const chunk = userIds.slice(0, 900);
    const [profiles, vip, wallets, sessions, overrides] = chunk.length
      ? await Promise.all([
          db.from("profiles").select("id,display_name,uid,email,vip_tier,outcome_mode").in("id", chunk),
          db.from("vip_accounts").select("user_id,level").in("user_id", chunk),
          db.from("wallets").select("user_id,currency,balance").in("user_id", chunk),
          db.from("user_sessions").select("user_id,ip_address,device_id,browser,os,device_type,last_active_at").in("user_id", chunk).order("last_active_at", { ascending: false }).limit(3000),
          db.from("user_fee_overrides").select("*").in("user_id", chunk),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }];

    const tierRows = (tiers.data ?? []) as any[];
    const base = tierRows[0] ?? null;
    const tierByLevel = new Map(tierRows.map((t) => [t.level, t]));

    const accounts: Record<string, any> = {};
    for (const p of (profiles.data ?? []) as any[]) {
      accounts[p.id] = { id: p.id, name: p.display_name, uid: p.uid, email: p.email, vipTier: p.vip_tier, outcomeMode: p.outcome_mode, vipLevel: 0, equityUsd: 0, ip: null, device: null };
    }
    for (const v of (vip.data ?? []) as any[]) if (accounts[v.user_id]) accounts[v.user_id].vipLevel = v.level;
    for (const w of (wallets.data ?? []) as any[]) {
      if (accounts[w.user_id] && PEGGED.has(String(w.currency).toUpperCase())) accounts[w.user_id].equityUsd += Number(w.balance);
    }
    for (const s of (sessions.data ?? []) as any[]) {
      const a = accounts[s.user_id];
      if (a && !a.ip) {
        a.ip = s.ip_address;
        a.device = { id: s.device_id, label: [s.device_type, s.os, s.browser].filter(Boolean).join(" / ") };
      }
    }
    const feeOverride = new Map(((overrides.data ?? []) as any[]).map((o) => [o.user_id, o]));

    const auditByRef: Record<string, any[]> = {};
    for (const a of (audits.data ?? []) as any[]) {
      const ref = a.details?.contractId ?? a.details?.positionId;
      const refs: string[] = ref ? [ref] : Array.isArray(a.details?.contractIds) ? a.details.contractIds : [];
      for (const r of refs) (auditByRef[r] ??= []).push(a);
    }

    function discount(userId: string, product: "scalp" | "spot" | "futures") {
      const lvl = accounts[userId]?.vipLevel ?? 0;
      const t = tierByLevel.get(lvl);
      const ov = feeOverride.get(userId);
      const key = `${product}_taker`;
      const baseRate = Number(base?.[key] ?? 0);
      const rate = ov?.[key] != null ? Number(ov[key]) : Number(t?.[key] ?? baseRate);
      return { rate, discountPct: baseRate > 0 ? Math.max(0, (1 - rate / baseRate) * 100) : 0 };
    }

    const rows: any[] = [];
    for (const c of (contracts.data ?? []) as any[]) {
      const stake = Number(c.stake);
      const payout = c.payout != null ? Number(c.payout) : null;
      const fee = Number(c.fee_paid ?? 0);
      rows.push({
        id: c.id, kind: "contract", userId: c.user_id, symbol: c.symbol, displaySymbol: c.display_symbol,
        side: c.direction, stake, currency: c.currency, entry: Number(c.entry_price),
        exit: c.exit_price != null ? Number(c.exit_price) : null, leverage: 1,
        status: c.status, result: c.result, payout, payoutPct: Number(c.payout_pct), fee,
        net: c.status === "settled" ? (payout ?? 0) - stake - fee : null,
        override: c.outcome_override, openedAt: c.opened_at, closedAt: c.settled_at, expiresAt: c.expires_at,
        durationSeconds: c.duration_seconds, fees: discount(c.user_id, "scalp"),
        audit: auditByRef[c.id] ?? [],
      });
    }
    for (const p of (positions.data ?? []) as any[]) {
      const qty = Number(p.quantity);
      const entry = Number(p.entry_price);
      const lev = Number(p.leverage);
      const fee = Number(p.fees_paid ?? 0);
      rows.push({
        id: p.id, kind: "position", userId: p.user_id, symbol: p.symbol, displaySymbol: p.display_symbol,
        assetClass: p.asset_class, side: p.side, stake: lev > 0 ? (qty * entry) / lev : qty * entry, notional: qty * entry,
        quantity: qty, currency: p.currency, entry, exit: p.exit_price != null ? Number(p.exit_price) : null,
        leverage: lev, status: p.status, result: p.realized_pnl == null ? null : Number(p.realized_pnl) >= 0 ? "win" : "loss",
        payout: null, fee, net: p.realized_pnl != null ? Number(p.realized_pnl) : null,
        override: "normal", openedAt: p.opened_at, closedAt: p.closed_at,
        fees: discount(p.user_id, lev > 1 ? "futures" : "spot"), audit: auditByRef[p.id] ?? [],
      });
    }
    rows.sort((a, b) => (a.openedAt < b.openedAt ? 1 : -1));

    return {
      rows,
      accounts,
      spreadPct: Number((settings.data?.value as any)?.spreadPct ?? 0),
      globalOutcome: ((settings.data?.value as any)?.defaultOutcome ?? "normal") as string,
      capped: (contracts.data?.length ?? 0) >= 1500 || (positions.data?.length ?? 0) >= 1500,
    };
  });

/** Emergency clearing: settle selected open contracts immediately at the current mark price. */
export const bulkSettleContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(200), reason: z.string().trim().min(5).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const roles = await myRoles(context);
    if (!roles.includes("admin")) throw new Error("Forbidden: Super Admin required for forced settlements.");
    const db = await privileged();
    const { settleContractRow } = await import("@/lib/contracts-settle.server");
    const { data: open } = await db.from("contracts").select("*").in("id", data.ids).eq("status", "open");
    const results: any[] = [];
    let failed = 0;
    for (const c of (open ?? []) as any[]) {
      try {
        const r = await settleContractRow(db, db, c.user_id, c);
        results.push({ id: c.id, ...r });
        await logAudit(db, context.userId, "trade.forced_settlement", c.user_id, {
          contractId: c.id, symbol: c.display_symbol, stake: Number(c.stake), entry: Number(c.entry_price),
          exit: r.exitPrice, result: r.result, payout: r.payout, reason: data.reason, scheduledExpiry: c.expires_at,
        });
      } catch {
        failed++;
      }
    }
    await logAudit(db, context.userId, "trade.bulk_settlement", null, {
      requested: data.ids.length, settled: results.length, failed, skipped: data.ids.length - (open?.length ?? 0),
      contractIds: results.map((r) => r.id), reason: data.reason,
    });
    return { settled: results.length, failed, skipped: data.ids.length - (open?.length ?? 0) };
  });
