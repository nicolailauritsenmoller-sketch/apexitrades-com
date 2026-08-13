import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertFinance, privileged, myRoles } from "@/lib/desk.server";

/* ------------------------------------------------------------------ */
/* Shared helpers                                                       */
/* ------------------------------------------------------------------ */

async function audit(
  context: { supabase: any; userId: string },
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown> = {},
) {
  const db = await privileged();
  const { data: me } = await db
    .from("profiles")
    .select("display_name")
    .eq("id", context.userId)
    .maybeSingle();
  await db.from("admin_audit_logs").insert({
    actor_id: context.userId,
    actor_name: me?.display_name ?? null,
    action,
    target_user_id: targetUserId,
    details,
  });
}

async function notify(db: any, userId: string, title: string, body: string, kind = "info") {
  await db.from("notifications").insert({ user_id: userId, title, body, kind });
}

/* ------------------------------------------------------------------ */
/* Risk & position monitor                                              */
/* ------------------------------------------------------------------ */

/** Every open leveraged position ranked by liquidation risk, plus per-user margin usage. */
export const getRiskMonitor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { fetchQuotes } = await import("./market.server");

    const { data: positions } = await db
      .from("positions")
      .select("*")
      .eq("status", "open")
      .order("opened_at", { ascending: false })
      .limit(300);

    const rows = (positions ?? []) as any[];
    const userIds = [...new Set(rows.map((p) => p.user_id))];
    const symbols = [...new Set(rows.map((p) => p.symbol))];

    const [{ data: profiles }, { data: wallets }, quotes] = await Promise.all([
      userIds.length
        ? db.from("profiles").select("id,display_name,uid,trading_frozen").in("id", userIds)
        : Promise.resolve({ data: [] }),
      userIds.length
        ? db.from("wallets").select("user_id,currency,balance").in("user_id", userIds)
        : Promise.resolve({ data: [] }),
      symbols.length ? fetchQuotes(symbols).catch(() => []) : Promise.resolve([]),
    ]);

    const priceBy = new Map<string, number>(
      (quotes as any[]).map((q) => [q.symbol, Number(q.price)]),
    );
    const nameBy = new Map<string, any>(((profiles ?? []) as any[]).map((p) => [p.id, p]));
    const cashBy = new Map<string, number>();
    for (const w of ((wallets ?? []) as any[])) {
      cashBy.set(w.user_id, (cashBy.get(w.user_id) ?? 0) + Number(w.balance ?? 0));
    }

    const marginBy = new Map<string, number>();
    const pnlBy = new Map<string, number>();

    const enriched = rows.map((p) => {
      const entry = Number(p.entry_price);
      const qty = Number(p.quantity);
      const lev = Number(p.leverage) || 1;
      const mark = priceBy.get(p.symbol) ?? entry;
      const dir = p.side === "long" ? 1 : -1;
      const margin = (entry * qty) / lev;
      const pnl = (mark - entry) * qty * dir;
      const equity = margin + pnl;
      /** 0 = healthy, 100 = margin fully consumed (liquidation). */
      const riskPct = margin > 0 ? Math.max(0, Math.min(100, (1 - equity / margin) * 100)) : 0;
      marginBy.set(p.user_id, (marginBy.get(p.user_id) ?? 0) + margin);
      pnlBy.set(p.user_id, (pnlBy.get(p.user_id) ?? 0) + pnl);
      const prof = nameBy.get(p.user_id);
      return {
        id: p.id,
        userId: p.user_id,
        userName: prof?.display_name ?? "—",
        uid: prof?.uid ?? null,
        symbol: p.symbol,
        displaySymbol: p.display_symbol,
        assetClass: p.asset_class,
        side: p.side,
        quantity: qty,
        leverage: lev,
        currency: p.currency,
        entryPrice: entry,
        markPrice: mark,
        margin,
        pnl,
        equity,
        riskPct,
        openedAt: p.opened_at,
      };
    });

    enriched.sort((a, b) => b.riskPct - a.riskPct);

    const accounts = [...marginBy.keys()].map((uid) => {
      const prof = nameBy.get(uid);
      const marginUsed = marginBy.get(uid) ?? 0;
      const openPnl = pnlBy.get(uid) ?? 0;
      const cash = cashBy.get(uid) ?? 0;
      const totalEquity = cash + marginUsed + openPnl;
      return {
        userId: uid,
        userName: prof?.display_name ?? "—",
        uid: prof?.uid ?? null,
        frozen: Boolean(prof?.trading_frozen),
        marginUsed,
        openPnl,
        cash,
        totalEquity,
        utilizationPct: totalEquity > 0 ? (marginUsed / totalEquity) * 100 : 0,
      };
    });
    accounts.sort((a, b) => b.utilizationPct - a.utilizationPct);

    return { positions: enriched, accounts };
  });

/** Emergency settle of a leveraged position at the live mark price. */
export const forceLiquidatePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), reason: z.string().trim().max(300).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { fetchPrice } = await import("./market.server");

    const { data: position } = await db
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!position) throw new Error("Position not found.");
    if (position.status === "closed") throw new Error("Position is already closed.");

    const price = await fetchPrice(position.symbol);
    const entry = Number(position.entry_price);
    const qty = Number(position.quantity);
    const dir = position.side === "long" ? 1 : -1;
    const pnl = (price - entry) * qty * dir;
    const margin = (entry * qty) / (Number(position.leverage) || 1);
    const payout = Math.max(0, margin + pnl);

    const { data: closed, error } = await db
      .from("positions")
      .update({
        status: "closed",
        exit_price: price,
        realized_pnl: pnl,
        closed_at: new Date().toISOString(),
      })
      .eq("id", position.id)
      .eq("status", "open")
      .select("id");
    if (error) throw new Error(error.message);
    if (!closed || closed.length === 0) throw new Error("Position is already closed.");

    const { data: wallet } = await db
      .from("wallets")
      .select("*")
      .eq("user_id", position.user_id)
      .eq("currency", position.currency)
      .maybeSingle();
    if (wallet) {
      await db
        .from("wallets")
        .update({
          balance: Number(wallet.balance) + payout,
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
    }

    await notify(
      db,
      position.user_id,
      "Position liquidated",
      `Your ${position.display_symbol} ${position.side} position was closed by risk management at ${price}.${
        data.reason ? ` Reason: ${data.reason}` : ""
      }`,
      pnl >= 0 ? "info" : "warning",
    );
    await audit(context, "risk.liquidate", position.user_id, {
      position_id: position.id,
      symbol: position.symbol,
      exit_price: price,
      pnl,
      reason: data.reason ?? null,
    });

    return { exitPrice: price, pnl, currency: position.currency };
  });

/* ------------------------------------------------------------------ */
/* User account controls & internal notes                               */
/* ------------------------------------------------------------------ */

/** Freeze/unfreeze trading and withdrawals for a single account. */
export const setUserAccountControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        tradingFrozen: z.boolean().optional(),
        withdrawalsDisabled: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const patch: Record<string, boolean> = {};
    if (data.tradingFrozen !== undefined) patch['trading_frozen'] = data.tradingFrozen;
    if (data.withdrawalsDisabled !== undefined)
      patch['withdrawals_disabled'] = data.withdrawalsDisabled;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await db.from("profiles").update(patch).eq("id", data.userId);
    if (error) throw new Error(error.message);

    await audit(context, "user.controls", data.userId, patch);
    await notify(
      db,
      data.userId,
      "Account status updated",
      data.tradingFrozen || data.withdrawalsDisabled
        ? "Some account features were restricted by compliance. Contact support for details."
        : "Account restrictions were lifted.",
      "warning",
    );
    return { ok: true };
  });

/** Ends every active session for the user and clears device records. */
export const terminateUserSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();

    let revoked = false;
    try {
      const url = process.env['SUPABASE_URL']!;
      const key = process.env['SUPABASE_SERVICE_ROLE_KEY']!;
      const res = await fetch(`${url}/auth/v1/admin/users/${data.userId}/logout`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      revoked = res.ok;
    } catch {
      revoked = false;
    }

    await db.from("user_sessions").delete().eq("user_id", data.userId);
    await audit(context, "user.sessions_terminated", data.userId, { revoked });
    return { ok: true, revoked };
  });

/** Issues a password recovery link for the account (returned to the admin). */
export const forcePasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: user, error } = await db.auth.admin.getUserById(data.userId);
    if (error || !user?.user?.email) throw new Error("User email not found.");

    const { data: link, error: linkError } = await db.auth.admin.generateLink({
      type: "recovery",
      email: user.user.email,
    });
    if (linkError) throw new Error(linkError.message);

    await notify(
      db,
      data.userId,
      "Password reset required",
      "An administrator initiated a password reset on your account. Check your email to set a new password.",
      "warning",
    );
    await audit(context, "user.password_reset", data.userId, { email: user.user.email });
    return { ok: true, link: (link as any)?.properties?.action_link ?? null };
  });

/** Internal staff notes attached to a user profile. */
export const getUserNotes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("admin_user_notes")
      .select("*")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

export const addUserNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ userId: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: me } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();
    const { error } = await db.from("admin_user_notes").insert({
      user_id: data.userId,
      author_id: context.userId,
      author_name: me?.display_name ?? null,
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await audit(context, "user.note_added", data.userId, {});
    return { ok: true };
  });

export const deleteUserNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("admin_user_notes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Accounting & revenue reporting                                       */
/* ------------------------------------------------------------------ */

/** Net deposits, trading fees collected and system P&L for a rolling window. */
export const getAccountingReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [deposits, withdrawals, contracts, positions, settings] = await Promise.all([
      db.from("deposits").select("*").gte("created_at", since),
      db.from("withdrawals").select("*").gte("created_at", since),
      db.from("contracts").select("*").gte("opened_at", since),
      db.from("positions").select("*").gte("opened_at", since),
      db.from("platform_settings").select("key,value").in("key", ["payments", "gateways"]),
    ]);

    const settingMap: Record<string, any> = {};
    for (const r of ((settings.data ?? []) as any[])) settingMap[r.key] = r.value ?? {};
    const depFeePct = Number(
      settingMap['gateways']?.depositFeePct ?? settingMap['payments']?.depositFeePct ?? 0,
    );
    const wdFeePct = Number(
      settingMap['gateways']?.withdrawalFeePct ?? settingMap['payments']?.withdrawalFeePct ?? 0,
    );

    const depRows = ((deposits.data ?? []) as any[]).filter((d) => d.status === "approved");
    const wdRows = ((withdrawals.data ?? []) as any[]).filter((w) => w.status === "approved");
    const totalDeposits = depRows.reduce((a, d) => a + Number(d.amount ?? 0), 0);
    const totalWithdrawals = wdRows.reduce((a, w) => a + Number(w.amount ?? 0), 0);

    const settled = ((contracts.data ?? []) as any[]).filter((c) => c.status !== "open");
    const contractStakes = settled.reduce((a, c) => a + Number(c.stake ?? 0), 0);
    const contractPayouts = settled.reduce((a, c) => a + Number(c.payout ?? 0), 0);
    const closedPositions = ((positions.data ?? []) as any[]).filter((p) => p.status === "closed");
    const traderRealized = closedPositions.reduce((a, p) => a + Number(p.realized_pnl ?? 0), 0);

    const depositFees = (totalDeposits * depFeePct) / 100;
    const withdrawalFees = (totalWithdrawals * wdFeePct) / 100;
    const tradingFees = depositFees + withdrawalFees;
    /** Positive = house profit. */
    const systemPnl = contractStakes - contractPayouts - traderRealized + tradingFees;

    const ledger = [
      ...depRows.map((d) => ({
        date: d.created_at,
        type: "deposit",
        user_id: d.user_id,
        asset: d.coin,
        amount: Number(d.amount ?? 0),
        status: d.status,
        reference: d.tx_hash ?? d.id,
      })),
      ...wdRows.map((w) => ({
        date: w.created_at,
        type: "withdrawal",
        user_id: w.user_id,
        asset: w.coin,
        amount: -Number(w.amount ?? 0),
        status: w.status,
        reference: w.destination_address ?? w.id,
      })),
      ...settled.map((c) => ({
        date: c.opened_at,
        type: `contract_${c.result ?? c.status}`,
        user_id: c.user_id,
        asset: c.display_symbol,
        amount: Number(c.payout ?? 0) - Number(c.stake ?? 0),
        status: c.status,
        reference: c.id,
      })),
      ...closedPositions.map((p) => ({
        date: p.closed_at ?? p.opened_at,
        type: "position_close",
        user_id: p.user_id,
        asset: p.display_symbol,
        amount: Number(p.realized_pnl ?? 0),
        status: p.status,
        reference: p.id,
      })),
    ].sort((a, b) => (a.date < b.date ? 1 : -1));

    return {
      days: data.days,
      totals: {
        totalDeposits,
        totalWithdrawals,
        netDeposits: totalDeposits - totalWithdrawals,
        pendingDeposits: ((deposits.data ?? []) as any[]).filter((d) => d.status === "pending")
          .length,
        pendingWithdrawals: ((withdrawals.data ?? []) as any[]).filter(
          (w) => w.status === "pending",
        ).length,
        depositFees,
        withdrawalFees,
        tradingFees,
        contractStakes,
        contractPayouts,
        traderRealized,
        systemPnl,
      },
      ledger: ledger.slice(0, 500),
    };
  });

/** Lightweight role probe used by ops panels that need finance-level gating. */
export const getOpsAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await myRoles(context);
    return { isAdmin: roles.includes("admin"), canFinance: roles.includes("finance") };
  });
