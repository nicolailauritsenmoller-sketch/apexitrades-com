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

    const inst = INSTRUMENT_MAP[data.symbol];
    if (!inst) throw new Error("Unknown instrument.");

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

    const price = await fetchPrice(inst.symbol);

    const { error: debitError } = await supabase
      .from("wallets")
      .update({
        balance: Number(wallet.balance) - data.stake,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);
    if (debitError) throw new Error(debitError.message);

    const expiresAt = new Date(Date.now() + tier.seconds * 1000).toISOString();

    const { data: contract, error } = await supabase
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
      await supabase.from("wallets").update({ balance: Number(wallet.balance) }).eq("id", wallet.id);
      throw new Error(error.message);
    }

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
    const { fetchPrice } = await import("./market.server");

    const { data: contract } = await supabase
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!contract) throw new Error("Contract not found.");
    if (contract.status === "settled") throw new Error("Contract already settled.");
    if (new Date(contract.expires_at).getTime() > Date.now()) {
      throw new Error("Contract has not expired yet.");
    }

    const exit = await fetchPrice(contract.symbol);
    const entry = Number(contract.entry_price);
    const stake = Number(contract.stake);
    const pct = Number(contract.payout_pct);

    // Settlement outcome can be overridden by an administrator, either for this
    // single contract or globally for the account.
    const { data: profile } = await supabase
      .from("profiles")
      .select("outcome_mode")
      .eq("id", userId)
      .maybeSingle();

    const override =
      contract.outcome_override && contract.outcome_override !== "normal"
        ? contract.outcome_override
        : (profile?.outcome_mode ?? "normal");

    let result: "win" | "loss" | "draw";
    if (override === "force_win") result = "win";
    else if (override === "force_loss") result = "loss";
    else if (exit === entry) result = "draw";
    else if ((exit > entry && contract.direction === "up") || (exit < entry && contract.direction === "down"))
      result = "win";
    else result = "loss";

    const payout = result === "win" ? stake + (stake * pct) / 100 : result === "draw" ? stake : 0;

    const { error: updateError } = await supabase
      .from("contracts")
      .update({
        status: "settled",
        exit_price: exit,
        result,
        payout,
        settled_at: new Date().toISOString(),
      })
      .eq("id", contract.id)
      .eq("status", "open");
    if (updateError) throw new Error(updateError.message);

    if (payout > 0) {
      const { data: wallet } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("currency", contract.currency)
        .maybeSingle();
      if (wallet) {
        await supabase
          .from("wallets")
          .update({
            balance: Number(wallet.balance) + payout,
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);
      }
    }

    return { result, exitPrice: exit, payout, currency: contract.currency };
  });
