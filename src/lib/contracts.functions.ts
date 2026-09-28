import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const placeInput = z.object({
  symbol: z.string().max(20),
  direction: z.enum(["up", "down"]),
  stake: z.number().positive().max(100_000_000),
  durationSeconds: z.number().int().positive(),
});

const settleInput = z.object({ id: z.string().uuid() });

export const getContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Server-side sweep: settle any contract that expired while the user was away.
    const { data: expired } = await context.supabase
      .from("contracts")
      .select("*")
      .eq("user_id", context.userId)
      .eq("status", "open")
      .lt("expires_at", new Date(Date.now() - 5000).toISOString())
      .limit(20);
    if (expired && expired.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { settleContractRow } = await import("./contracts-settle.server");
      for (const c of expired) {
        try {
          await settleContractRow(context.supabase, supabaseAdmin, context.userId, c);
        } catch {
          /* already settled concurrently */
        }
      }
    }

    const { data } = await context.supabase
      .from("contracts")
      .select("*")
      .eq("user_id", context.userId)
      .order("opened_at", { ascending: false })
      .limit(60);

    return (data ?? []).map((c) => ({
      id: c.id,
      symbol: c.symbol,
      displaySymbol: c.display_symbol,
      direction: c.direction as "up" | "down",
      stake: Number(c.stake),
      currency: c.currency,
      durationSeconds: c.duration_seconds,
      payoutPct: Number(c.payout_pct),
      entryPrice: Number(c.entry_price),
      exitPrice: c.exit_price == null ? null : Number(c.exit_price),
      status: c.status as "open" | "settled",
      result: c.result as "win" | "loss" | "draw" | null,
      payout: c.payout == null ? null : Number(c.payout),
      openedAt: c.opened_at,
      expiresAt: c.expires_at,
      settledAt: c.settled_at,
    }));
  });

export type ContractRow = Awaited<ReturnType<typeof getContracts>>[number];

export const placeContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => placeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { INSTRUMENT_MAP, displaySymbol } = await import("./instruments");
    const { TIER_MAP, CONTRACT_CURRENCY } = await import("./contract-tiers");
    const { fetchPrice } = await import("./market.server");
    // Financial writes bypass the caller's token: clients have no write access
    // to wallets/contracts, so every value here is derived server-side.
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

    const tier = TIER_MAP[data.durationSeconds];
    if (!tier) throw new Error("Unknown contract duration.");
    if (data.stake < tier.minInvestment) {
      throw new Error(
        `Minimum investment for ${tier.label} is ${tier.minInvestment.toLocaleString("en-US")} ${CONTRACT_CURRENCY}.`,
      );
    }

    const { data: wallet } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .eq("currency", CONTRACT_CURRENCY)
      .maybeSingle();

    if (!wallet) throw new Error(`No ${CONTRACT_CURRENCY} wallet found.`);
    if (Number(wallet.balance) < data.stake) {
      throw new Error(
        `Insufficient ${CONTRACT_CURRENCY} balance. Need ${data.stake.toFixed(2)}, have ${Number(wallet.balance).toFixed(2)}.`,
      );
    }

    const submittedAt = Date.now();
    const price = await fetchPrice(inst.symbol);
    const acknowledgedAt = Date.now();

    const { error: debitError } = await db
      .from("wallets")
      .update({
        balance: Number(wallet.balance) - data.stake,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("user_id", userId);
    if (debitError) throw new Error(debitError.message);

    const expiresAt = new Date(Date.now() + tier.seconds * 1000).toISOString();

    const { data: contract, error } = await db
      .from("contracts")
      .insert({
        user_id: userId,
        symbol: inst.symbol,
        display_symbol: displaySymbol(inst.symbol),
        direction: data.direction,
        stake: data.stake,
        currency: CONTRACT_CURRENCY,
        duration_seconds: tier.seconds,
        payout_pct: tier.profitPct,
        entry_price: price,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      await db
        .from("wallets")
        .update({ balance: Number(wallet.balance) })
        .eq("id", wallet.id)
        .eq("user_id", userId);
      throw new Error(error.message);
    }

    const { recordExecution } = await import("./execution.server");
    await recordExecution(db, {
      userId,
      refType: "contract",
      refId: contract.id,
      symbol: inst.symbol,
      side: data.direction,
      requestedQty: data.stake,
      filledQty: data.stake,
      submittedAt,
      acknowledgedAt,
      filledAt: Date.now(),
    });

    return {
      id: contract.id,
      entryPrice: price,
      expiresAt,
      expectedProfit: (data.stake * tier.profitPct) / 100,
      currency: CONTRACT_CURRENCY,
    };
  });

export const settleContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settleInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!contract) throw new Error("Contract not found.");
    if (contract.status === "settled") {
      // Already settled (e.g. by the background sweep) - return the stored result instead of failing.
      return {
        result: contract.result as "win" | "loss" | "draw",
        exitPrice: Number(contract.exit_price),
        payout: Number(contract.payout ?? 0),
        currency: contract.currency as string,
      };
    }
    const remaining = new Date(contract.expires_at).getTime() - Date.now();
    if (remaining > 5000) {
      throw new Error("Contract has not expired yet.");
    }
    // Absorb small client/server clock drift: wait out the last moments server-side
    // so the client never has to re-poll.
    if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));

    const { settleContractRow } = await import("./contracts-settle.server");
    return settleContractRow(supabase, db, userId, contract);
  });
