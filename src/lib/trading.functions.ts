import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const openInput = z.object({
  symbol: z.string().max(20),
  side: z.enum(["long", "short"]),
  quantity: z.number().positive().max(1_000_000),
  leverage: z.number().min(1).max(100),
});

const closeInput = z.object({ id: z.string().uuid() });

export const getPortfolio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [profile, wallets, positions] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("wallets").select("*").eq("user_id", userId).order("currency"),
      supabase
        .from("positions")
        .select("*")
        .eq("user_id", userId)
        .order("opened_at", { ascending: false })
        .limit(100),
    ]);

    return {
      profile: profile.data,
      wallets: (wallets.data ?? []).map((w) => ({
        currency: w.currency,
        balance: Number(w.balance),
      })),
      positions: (positions.data ?? []).map((p) => ({
        id: p.id,
        symbol: p.symbol,
        displaySymbol: p.display_symbol,
        assetClass: p.asset_class,
        side: p.side,
        quantity: Number(p.quantity),
        entryPrice: Number(p.entry_price),
        exitPrice: p.exit_price == null ? null : Number(p.exit_price),
        leverage: Number(p.leverage),
        currency: p.currency,
        status: p.status,
        realizedPnl: p.realized_pnl == null ? null : Number(p.realized_pnl),
        openedAt: p.opened_at,
        closedAt: p.closed_at,
      })),
    };
  });

export const openPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => openInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { INSTRUMENT_MAP, displaySymbol } = await import("./instruments");
    const { fetchPrice } = await import("./market.server");
    // Clients cannot write wallets/positions directly; all values are derived here.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const inst = INSTRUMENT_MAP[data.symbol];
    if (!inst) throw new Error("Unknown instrument.");

    const { assertAccountUsable } = await import("./account-status.functions");
    const guard = await assertAccountUsable(supabase, userId);
    if (guard.tradingFrozen) {
      throw new Error("Trading is frozen on this account. Contact support.");
    }
    if (guard.verificationRequired) {
      throw new Error("Additional verification is required before trading. Complete verification in your profile.");
    }
    if (guard.marginRestricted && data.leverage > 1) {
      throw new Error("Margin trading is restricted on this account. Use 1× leverage.");
    }

    const submittedAt = Date.now();
    const price = await fetchPrice(inst.symbol);
    const acknowledgedAt = Date.now();
    const notional = price * data.quantity;
    const margin = notional / data.leverage;
    const { resolveFeeRate, feeAmount, productFor } = await import("./vip-fees.server");
    const feeRate = await resolveFeeRate(db, userId, productFor(inst.assetClass, data.leverage), "taker");
    const fee = feeAmount(notional, feeRate);
    const required = margin + fee;

    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("currency", inst.currency)
      .maybeSingle();

    if (!wallet) throw new Error(`No ${inst.currency} wallet found.`);
    if (Number(wallet.balance) < required) {
      throw new Error(
        `Insufficient ${inst.currency} margin. Need ${required.toFixed(2)} (incl. ${fee.toFixed(2)} fee), have ${Number(wallet.balance).toFixed(2)}.`,
      );
    }

    const { walletAdjust } = await import("./wallet-atomic.server");
    await walletAdjust(db, userId, inst.currency, -required);

    const { data: position, error } = await db
      .from("positions")
      .insert({
        user_id: userId,
        symbol: inst.symbol,
        display_symbol: displaySymbol(inst.symbol),
        asset_class: inst.assetClass,
        side: data.side,
        quantity: data.quantity,
        entry_price: price,
        leverage: data.leverage,
        currency: inst.currency,
        fees_paid: fee,
      })
      .select()
      .single();

    if (error) {
      await walletAdjust(db, userId, inst.currency, required);
      throw new Error(error.message);
    }

    const { recordExecution } = await import("./execution.server");
    await recordExecution(db, {
      userId,
      refType: "position_open",
      refId: position.id,
      symbol: inst.symbol,
      side: data.side,
      requestedQty: data.quantity,
      filledQty: data.quantity,
      submittedAt,
      acknowledgedAt,
      filledAt: Date.now(),
    });

    return { id: position.id, entryPrice: price, margin, currency: inst.currency };
  });

export const closePosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => closeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { fetchPrice } = await import("./market.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: position } = await supabase
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!position) throw new Error("Position not found.");
    if (position.status === "closed") throw new Error("Position is already closed.");

    const submittedAt = Date.now();
    const price = await fetchPrice(position.symbol);
    const acknowledgedAt = Date.now();
    const entry = Number(position.entry_price);
    const qty = Number(position.quantity);
    const direction = position.side === "long" ? 1 : -1;
    const grossPnl = (price - entry) * qty * direction;
    const margin = (entry * qty) / Number(position.leverage);
    const { resolveFeeRate, feeAmount, productFor } = await import("./vip-fees.server");
    const closeRate = await resolveFeeRate(
      db,
      userId,
      productFor(position.asset_class, Number(position.leverage)),
      "taker",
    );
    const closeFee = feeAmount(price * qty, closeRate);
    const pnl = grossPnl - closeFee;
    const payout = Math.max(0, margin + pnl);

    const { data: closed, error: closeError } = await db
      .from("positions")
      .update({
        status: "closed",
        exit_price: price,
        realized_pnl: pnl,
        fees_paid: Number((position as any).fees_paid ?? 0) + closeFee,
        closed_at: new Date().toISOString(),
      })
      .eq("id", position.id)
      .eq("user_id", userId)
      .eq("status", "open")
      .select("id");
    if (closeError) throw new Error(closeError.message);
    if (!closed || closed.length === 0) throw new Error("Position is already closed.");

    const { data: wallet } = await db
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("currency", position.currency)
      .maybeSingle();

    if (wallet) {
      const { walletAdjust } = await import("./wallet-atomic.server");
      await walletAdjust(db, userId, position.currency, payout);
    }

    const { recordExecution } = await import("./execution.server");
    await recordExecution(db, {
      userId,
      refType: "position_close",
      refId: position.id,
      symbol: position.symbol,
      side: position.side,
      requestedQty: qty,
      filledQty: qty,
      submittedAt,
      acknowledgedAt,
      filledAt: Date.now(),
    });

    return { exitPrice: price, pnl, currency: position.currency };
  });

export const getWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("watchlist")
      .select("symbol")
      .eq("user_id", context.userId);
    return (data ?? []).map((r) => r.symbol);
  });

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ symbol: z.string().max(20) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", userId)
      .eq("symbol", data.symbol)
      .maybeSingle();

    if (existing) {
      await supabase.from("watchlist").delete().eq("id", existing.id);
      return { watching: false };
    }
    await supabase.from("watchlist").insert({ user_id: userId, symbol: data.symbol });
    return { watching: true };
  });
