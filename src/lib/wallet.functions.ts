import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MIN_WITHDRAWAL_CREDIT_SCORE } from "@/lib/limits";

const depositInput = z.object({
  coin: z.string().min(1).max(12),
  network: z.string().min(1).max(24),
  amount: z.number().positive().max(100_000_000),
  txHash: z.string().trim().max(200).optional(),
  receiptPath: z.string().trim().max(400).optional(),
});

const withdrawInput = z.object({
  coin: z.string().min(1).max(16),
  network: z.string().min(1).max(24),
  amount: z.number().positive().max(100_000_000),
  destinationAddress: z.string().trim().min(8).max(200),
});

const swapInput = z.object({
  from: z.string().min(1).max(16),
  to: z.string().min(1).max(16),
  amount: z.number().positive().max(100_000_000),
});


export const getDepositAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("deposit_addresses")
      .select("*")
      .eq("active", true)
      .order("coin");
    return (data ?? []).map((a) => ({
      id: a.id,
      coin: a.coin,
      network: a.network,
      address: a.address,
      memo: a.memo,
    }));
  });

export const getWalletActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [deposits, withdrawals, swaps] = await Promise.all([
      supabase
        .from("deposits")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("withdrawals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
      supabase
        .from("swaps")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

    return {
      deposits: (deposits.data ?? []).map((d) => ({
        id: d.id,
        coin: d.coin,
        network: d.network,
        amount: Number(d.amount),
        status: d.status as string,
        txHash: d.tx_hash,
        adminNote: d.admin_note,
        createdAt: d.created_at,
      })),
      withdrawals: (withdrawals.data ?? []).map((w) => ({
        id: w.id,
        coin: w.coin,
        network: w.network,
        amount: Number(w.amount),
        status: w.status as string,
        destinationAddress: w.destination_address,
        adminNote: w.admin_note,
        createdAt: w.created_at,
      })),
      swaps: (swaps.data ?? []).map((s) => ({
        id: s.id,
        fromCurrency: s.from_currency,
        toCurrency: s.to_currency,
        fromAmount: Number(s.from_amount),
        toAmount: Number(s.to_amount),
        rate: Number(s.rate),
        createdAt: s.created_at,
      })),
    };
  });

/** Live USDT valuation of every wallet the user holds. */
export const getPortfolioValue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { usdtRates, assetUsdtRates } = await import("./rates.server");
    const { data: wallets } = await context.supabase
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .order("currency");

    const codes = (wallets ?? []).map((w) => w.currency);
    const [base, extra] = await Promise.all([
      usdtRates(),
      assetUsdtRates(codes.filter((c) => !["USD", "EUR", "GBP", "USDT", "BTC"].includes(c))),
    ]);
    const rates = { ...base, ...extra };

    const rows = (wallets ?? []).map((w) => {
      const rate = rates[w.currency] ?? 0;
      return {
        currency: w.currency,
        balance: Number(w.balance),
        rate,
        valueUsdt: Number(w.balance) * rate,
      };
    });

    return { rates, wallets: rows, totalUsdt: rows.reduce((s, r) => s + r.valueUsdt, 0) };
  });

/** Live conversion rate between any two supported assets. */
export const getSwapRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ from: z.string().min(1).max(16), to: z.string().min(1).max(16) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { assetUsdtRates } = await import("./rates.server");
    const rates = await assetUsdtRates([data.from, data.to]);
    const fromRate = rates[data.from.toUpperCase()] ?? 0;
    const toRate = rates[data.to.toUpperCase()] ?? 0;
    return {
      fromRate,
      toRate,
      rate: fromRate > 0 && toRate > 0 ? fromRate / toRate : 0,
    };
  });

/** Credit score / KYC gate shown on the withdrawal form. */
export const getWithdrawalEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: kyc }] = await Promise.all([
      supabase.from("profiles").select("credit_score").eq("id", userId).maybeSingle(),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const creditScore = Number((profile as any)?.credit_score ?? 750);
    const kycStatus = (kyc as any)?.status ?? "unverified";
    const reasons: string[] = [];
    if (kycStatus !== "approved") reasons.push("Identity verification (KYC) must be approved.");
    if (creditScore < MIN_WITHDRAWAL_CREDIT_SCORE) {
      reasons.push(
        `Credit score ${creditScore} is below the ${MIN_WITHDRAWAL_CREDIT_SCORE} withdrawal threshold.`,
      );
    }

    return { creditScore, kycStatus, canWithdraw: reasons.length === 0, reasons };
  });


export const requestDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => depositInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("deposits")
      .insert({
        user_id: context.userId,
        coin: data.coin,
        network: data.network,
        amount: data.amount,
        tx_hash: data.txHash || null,
        receipt_path: data.receiptPath || null,
      })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string, createdAt: row.created_at as string };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => withdrawInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const [{ data: wallet }, { data: profile }, { data: kyc }] = await Promise.all([
      supabase
        .from("wallets")
        .select("*")
        .eq("user_id", userId)
        .eq("currency", data.coin)
        .maybeSingle(),
      supabase.from("profiles").select("credit_score").eq("id", userId).maybeSingle(),
      supabase
        .from("kyc_submissions")
        .select("status")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if ((kyc as any)?.status !== "approved") {
      throw new Error("Withdrawals require an approved identity verification (KYC).");
    }
    if (Number((profile as any)?.credit_score ?? 750) < MIN_WITHDRAWAL_CREDIT_SCORE) {
      throw new Error(
        `Your credit score is below the ${MIN_WITHDRAWAL_CREDIT_SCORE} threshold required for withdrawals.`,
      );
    }

    if (!wallet || Number(wallet.balance) < data.amount) {
      throw new Error(`Insufficient ${data.coin} balance for this withdrawal.`);
    }


    const { data: row, error } = await supabase
      .from("withdrawals")
      .insert({
        user_id: userId,
        coin: data.coin,
        network: data.network,
        amount: data.amount,
        destination_address: data.destinationAddress,
      })
      .select("id,created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id as string, createdAt: row.created_at as string };
  });

export const swapAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => swapInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assetUsdtRates } = await import("./rates.server");
    // Clients have no write access to wallets; swap amounts are computed here.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    data = { ...data, from: data.from.toUpperCase(), to: data.to.toUpperCase() };
    if (data.from === data.to) throw new Error("Pick two different assets.");

    const rates = await assetUsdtRates([data.from, data.to]);
    const fromRate = rates[data.from];
    const toRate = rates[data.to];
    if (!fromRate || !toRate) throw new Error("Live pricing unavailable for this pair.");


    const rate = fromRate / toRate;
    const toAmount = data.amount * rate;

    const { data: wallets } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", userId)
      .in("currency", [data.from, data.to]);

    const fromWallet = (wallets ?? []).find((w) => w.currency === data.from);
    const toWallet = (wallets ?? []).find((w) => w.currency === data.to);

    if (!fromWallet || Number(fromWallet.balance) < data.amount) {
      throw new Error(`Insufficient ${data.from} balance.`);
    }

    const now = new Date().toISOString();
    const { error: debitError } = await db
      .from("wallets")
      .update({ balance: Number(fromWallet.balance) - data.amount, updated_at: now })
      .eq("id", fromWallet.id)
      .eq("user_id", userId);
    if (debitError) throw new Error(debitError.message);

    if (toWallet) {
      await db
        .from("wallets")
        .update({ balance: Number(toWallet.balance) + toAmount, updated_at: now })
        .eq("id", toWallet.id)
        .eq("user_id", userId);
    } else {
      await db
        .from("wallets")
        .insert({ user_id: userId, currency: data.to, balance: toAmount });
    }

    await supabase.from("swaps").insert({
      user_id: userId,
      from_currency: data.from,
      to_currency: data.to,
      from_amount: data.amount,
      to_amount: toAmount,
      rate,
    });

    return { toAmount, rate };
  });
