import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  myRoles,
  assertAdmin,
  assertStaff,
  assertFinance,
  privileged,
} from "@/lib/desk.server";

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await myRoles(context);
    const isAdmin = roles.includes("admin");
    const isFinance = roles.includes("finance");
    const isAgent = roles.includes("agent");
    return {
      roles,
      isAdmin,
      isFinance,
      isAgent,
      /** Super Admin or Finance Admin: money movement + balance adjustments. */
      canFinance: isAdmin || isFinance,
      /** Any staff member: tickets, live chat, read-only user profiles. */
      isStaff: isAdmin || isFinance || isAgent,
    };
  });



export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // KYC records and financial ledgers are admin-only.
    await assertFinance(context);
    const { supabase } = context;

    const [deposits, withdrawals, kyc, addresses, profiles, contracts] = await Promise.all([
      supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(80),
      supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(80),
      supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase.from("deposit_addresses").select("*").order("coin"),
      supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(200),
      supabase
        .from("contracts")
        .select("*")
        .eq("status", "open")
        .order("expires_at", { ascending: true })
        .limit(100),
    ]);

    return {
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
      kyc: kyc.data ?? [],
      addresses: addresses.data ?? [],
      profiles: profiles.data ?? [],
      openContracts: contracts.data ?? [],
    };
  });

const reviewInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

async function notify(supabase: any, userId: string, title: string, body: string, kind = "info") {
  await supabase.from("notifications").insert({ user_id: userId, title, body, kind });
}

/** Records a staff action in the immutable admin audit trail. */
async function writeAudit(
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


export const reviewDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const { supabase, userId } = context;

    const { data: dep } = await supabase.from("deposits").select("*").eq("id", data.id).maybeSingle();
    if (!dep) throw new Error("Deposit not found.");
    if (dep.status !== "pending") throw new Error("Deposit already reviewed.");

    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("deposits")
      .update({
        status,
        admin_note: data.note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", dep.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    if (data.action === "approve") {
      const db = await privileged();
      const { data: wallet } = await db
        .from("wallets")
        .select("*")
        .eq("user_id", dep.user_id)
        .eq("currency", dep.coin)
        .maybeSingle();

      if (wallet) {
        await db
          .from("wallets")
          .update({
            balance: Number(wallet.balance) + Number(dep.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);
      } else {
        await db
          .from("wallets")
          .insert({ user_id: dep.user_id, currency: dep.coin, balance: Number(dep.amount) });
      }

      const { maybeFlagVipRequest } = await import("./vip-activation.server");
      await maybeFlagVipRequest(dep.user_id);
    }

    await writeAudit(context, `deposit.${data.action}`, dep.user_id, {
      amount: Number(dep.amount),
      coin: dep.coin,
      network: dep.network,
      note: data.note ?? null,
    });

    await notify(
      supabase,
      dep.user_id,
      data.action === "approve" ? "Deposit settled" : "Deposit compliance check failed",
      `${Number(dep.amount)} ${dep.coin} (${dep.network}) — ${data.action === "approve" ? "clearing complete" : "security review unsuccessful"}.${data.note ? ` Review note: ${data.note}` : ""}`,
      data.action === "approve" ? "success" : "warning",
    );

    return { ok: true };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const { supabase, userId } = context;

    const { data: wd } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!wd) throw new Error("Withdrawal not found.");
    if (wd.status !== "pending") throw new Error("Withdrawal already reviewed.");

    // Funds were already held (debited) when the user submitted the request.
    // Approval simply finalises it; rejection refunds the held amount.
    // Settle the status first so a failed update can never double-credit.
    const status = data.action === "approve" ? "approved" : "rejected";
    const { data: settled, error } = await supabase
      .from("withdrawals")
      .update({
        status,
        admin_note: data.note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", wd.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!settled) throw new Error("Withdrawal already reviewed.");

    if (data.action !== "approve") {
      const db = await privileged();
      const { data: wallet } = await db
        .from("wallets")
        .select("*")
        .eq("user_id", wd.user_id)
        .eq("currency", wd.coin)
        .maybeSingle();
      if (wallet) {
        await db
          .from("wallets")
          .update({
            balance: Number(wallet.balance) + Number(wd.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);
      } else {
        await db
          .from("wallets")
          .insert({ user_id: wd.user_id, currency: wd.coin, balance: Number(wd.amount) });
      }
    }

    await writeAudit(context, `withdrawal.${data.action}`, wd.user_id, {
      amount: Number(wd.amount),
      coin: wd.coin,
      destination: wd.destination_address,
      note: data.note ?? null,
    });

    await notify(
      supabase,
      wd.user_id,
      data.action === "approve" ? "Withdrawal settled" : "Withdrawal compliance check failed",
      `${Number(wd.amount)} ${wd.coin} to ${wd.destination_address} — ${data.action === "approve" ? "settlement complete" : "security review unsuccessful"}.${data.note ? ` Review note: ${data.note}` : ""}`,
      data.action === "approve" ? "success" : "warning",
    );

    return { ok: true };
  });

export const reviewKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const status = data.action === "approve" ? "approved" : "rejected";
    const { data: row, error } = await supabase
      .from("kyc_submissions")
      .update({
        status,
        admin_note: data.note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      await writeAudit(context, `kyc.${data.action}`, row.user_id, { note: data.note ?? null });
      await notify(
        supabase,
        row.user_id,
        data.action === "approve" ? "Verification complete" : "Identity compliance check failed",
        data.note ?? (data.action === "approve" ? "Your identity verification is complete." : "Your identity submission did not pass the compliance review."),
        data.action === "approve" ? "success" : "warning",
      );
      if (data.action === "approve") {
        const { settleReferralOnKyc } = await import("@/lib/referrals.server");
        await settleReferralOnKyc(row.user_id, userId).catch(() => undefined);
      }
    }
    return { ok: true };
  });

/** Approve or reject the enhanced (Level 2) verification stage independently. */
export const reviewKycLevel2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const status = data.action === "approve" ? "approved" : "rejected";
    const { data: row, error } = await supabase
      .from("kyc_submissions")
      .update({
        level2_status: status,
        level2_admin_note: data.note ?? null,
        level2_reviewed_by: userId,
        level2_reviewed_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      await writeAudit(context, `kyc.level2.${data.action}`, row.user_id, {
        note: data.note ?? null,
      });
      await notify(
        supabase,
        row.user_id,
        data.action === "approve"
          ? "Level 2 verification complete"
          : "Level 2 compliance check failed",
        data.note ?? (data.action === "approve" ? "Your Level 2 verification is complete." : "Your Level 2 submission did not pass the compliance review."),
        data.action === "approve" ? "success" : "warning",
      );
    }
    return { ok: true };
  });

export const getKycDocumentUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase
      .from("kyc_submissions")
      .select("document_path, selfie_path, level2_selfie_path, level2_proof_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Submission not found.");

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await context.supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 3600);
      return signed?.signedUrl ?? null;
    };

    const r = row as Record<string, string | null>;
    return {
      document: await sign(row.document_path),
      selfie: await sign(row.selfie_path),
      level2Selfie: await sign(r["level2_selfie_path"] ?? null),
      level2Proof: await sign(r["level2_proof_path"] ?? null),
    };
  });

/** Signed URL for a deposit's proof-of-payment screenshot. */
export const getDepositProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: row } = await context.supabase
      .from("deposits")
      .select("receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row?.receipt_path) return { url: null };
    const { data: signed } = await context.supabase.storage
      .from("deposit-proofs")
      .createSignedUrl(row.receipt_path, 600);
    return { url: signed?.signedUrl ?? null };
  });


const addressInput = z.object({
  id: z.string().uuid().optional(),
  coin: z.string().trim().min(1).max(12),
  network: z.string().trim().min(1).max(24),
  address: z.string().trim().min(4).max(200),
  memo: z.string().trim().max(120).optional(),
  active: z.boolean().default(true),
});

export const upsertDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => addressInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      coin: data.coin.toUpperCase(),
      network: data.network,
      address: data.address,
      memo: data.memo || null,
      active: data.active,
      updated_at: new Date().toISOString(),
    };
    // Caller is verified admin above; write through the service role so the
    // save never depends on policy evaluation quirks.
    const db = await privileged();
    const { error } = data.id
      ? await db.from("deposit_addresses").update(payload).eq("id", data.id)
      : await db.from("deposit_addresses").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("deposit_addresses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserOutcomeMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        mode: z.enum(["normal", "force_win", "force_loss"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("profiles")
      .update({ outcome_mode: data.mode })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setContractOutcomeMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        contractId: z.string().uuid(),
        mode: z.enum(["normal", "force_win", "force_loss"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db
      .from("contracts")
      .update({ outcome_override: data.mode })
      .eq("id", data.contractId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const broadcastNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(2).max(120),
        body: z.string().trim().min(2).max(1000),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    // Every notification row is addressed to exactly one account. A
    // platform-wide message is fanned out into one explicitly targeted row per
    // recipient — never a single "everyone" row.
    let recipients: string[];
    if (data.userId) {
      recipients = [data.userId];
    } else {
      const { data: profiles, error: listError } = await context.supabase
        .from("profiles")
        .select("id");
      if (listError) throw new Error(listError.message);
      recipients = (profiles ?? []).map((p) => p.id);
    }
    if (recipients.length === 0) return { ok: true, delivered: 0 };

    const { error } = await context.supabase.from("notifications").insert(
      recipients.map((userId) => ({
        user_id: userId,
        title: data.title,
        body: data.body,
        kind: "announcement",
      })),
    );
    if (error) throw new Error(error.message);
    return { ok: true, delivered: recipients.length };
  });


export const getSupportInbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data } = await context.supabase
      .from("chat_sessions")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(100);
    return data ?? [];
  });

export const getUserWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const { data: rows } = await context.supabase
      .from("wallets")
      .select("*")
      .eq("user_id", data.userId)
      .order("currency");
    return rows ?? [];
  });

export const adjustUserBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        currency: z.string().trim().min(1).max(12),
        amount: z.number().finite(),
        mode: z.enum(["set", "delta"]).default("delta"),
        kind: z.enum(["credit", "debit", "bonus", "correction"]).default("correction"),
        reason: z.string().trim().max(400).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const currency = data.currency.toUpperCase();
    const db = await privileged();
    const { data: wallet } = await db
      .from("wallets")
      .select("*")
      .eq("user_id", data.userId)
      .eq("currency", currency)
      .maybeSingle();

    const next =
      data.mode === "set" ? data.amount : Number(wallet?.balance ?? 0) + data.amount;
    if (next < 0) throw new Error("Resulting balance cannot be negative.");

    if (wallet) {
      const { error } = await db
        .from("wallets")
        .update({ balance: next, updated_at: new Date().toISOString() })
        .eq("id", wallet.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("wallets")
        .insert({ user_id: data.userId, currency, balance: next });
      if (error) throw new Error(error.message);
    }


    await writeAudit(context, `balance.${data.kind}`, data.userId, {
      currency,
      amount: data.amount,
      mode: data.mode,
      kind: data.kind,
      reason: data.reason ?? null,
      previous_balance: Number(wallet?.balance ?? 0),
      resulting_balance: next,
    });

    const label =
      data.kind === "bonus" ? "Bonus credited" : data.kind === "debit" ? "Balance debited" : "Balance updated";
    await notify(
      context.supabase,
      data.userId,
      label,
      `Your ${currency} balance was updated by Account Operations to ${next}.${data.reason ? ` Reason: ${data.reason}` : ""}`,
      data.kind === "debit" ? "warning" : "success",
    );
    return { balance: next };
  });


/** Aggregated metrics, activity feeds and ledgers for the admin control center. */
export const getAdminAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const iso = (d: Date) => d.toISOString();
    const now = new Date();
    const day = new Date(now.getTime() - 864e5);
    const week = new Date(now.getTime() - 7 * 864e5);
    const month = new Date(now.getTime() - 30 * 864e5);

    const [profiles, deposits, withdrawals, contracts, sessions, chats, swaps, wallets, kyc, ticketRows] =
      await Promise.all([
        db.from("profiles").select("id,display_name,uid,created_at,outcome_mode,referred_by,referral_rewards_usdt,base_currency").order("created_at", { ascending: false }).limit(500),
        db.from("deposits").select("id,user_id,coin,amount,status,created_at").order("created_at", { ascending: false }).limit(500),
        db.from("withdrawals").select("id,user_id,coin,amount,status,created_at").order("created_at", { ascending: false }).limit(500),
        db.from("contracts").select("id,user_id,display_symbol,direction,stake,currency,status,result,payout,opened_at,expires_at,settled_at").order("opened_at", { ascending: false }).limit(500),
        db.from("user_sessions").select("id,user_id,browser,os,ip_address,country,last_active_at,created_at").order("last_active_at", { ascending: false }).limit(60),
        db.from("chat_sessions").select("id,user_id,subject,status,last_message_at").order("last_message_at", { ascending: false }).limit(60),
        db.from("swaps").select("id,user_id,from_currency,to_currency,from_amount,to_amount,created_at").order("created_at", { ascending: false }).limit(60),
        db.from("wallets").select("currency,balance"),
        db.from("kyc_submissions").select("id,user_id,full_name,status,document_expires_at,created_at").order("created_at", { ascending: false }).limit(200),
        db.from("support_tickets").select("id,status"),
      ]);

    const P: any[] = (profiles.data ?? []) as any[];
    const D: any[] = (deposits.data ?? []) as any[];
    const W: any[] = (withdrawals.data ?? []) as any[];
    const C: any[] = (contracts.data ?? []) as any[];
    const K: any[] = (kyc.data ?? []) as any[];

    const since = (rows: any[], field: string, from: Date) =>
      rows.filter((r) => new Date(r[field]).getTime() >= from.getTime()).length;
    const sum = (rows: any[], pred: (r: any) => boolean) =>
      rows.filter(pred).reduce((a, r) => a + Number(r.amount ?? 0), 0);

    const settled = C.filter((c) => c.status !== "open");
    const revenue = settled.reduce(
      (a, c) => a + (Number(c.payout ?? 0) > 0 ? -(Number(c.payout) - Number(c.stake)) : Number(c.stake)),
      0,
    );

    // 14-day time series for charts
    const series: {
      date: string;
      signups: number;
      deposits: number;
      withdrawals: number;
      revenue: number;
      visitors: number;
    }[] = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(now.getTime() - i * 864e5);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 864e5);
      const inRange = (v: string) => {
        const t = new Date(v).getTime();
        return t >= start.getTime() && t < end.getTime();
      };
      const dayContracts = settled.filter((c) => c.settled_at && inRange(c.settled_at));
      series.push({
        date: iso(start).slice(0, 10),
        signups: P.filter((p) => inRange(p.created_at)).length,
        deposits: D.filter((d) => d.status === "approved" && inRange(d.created_at)).reduce(
          (a, d) => a + Number(d.amount),
          0,
        ),
        withdrawals: W.filter((w) => w.status === "approved" && inRange(w.created_at)).reduce(
          (a, w) => a + Number(w.amount),
          0,
        ),
        revenue: dayContracts.reduce(
          (a, c) =>
            a + (Number(c.payout ?? 0) > 0 ? -(Number(c.payout) - Number(c.stake)) : Number(c.stake)),
          0,
        ),
        visitors: (sessions.data ?? []).filter((s: any) => inRange(s.last_active_at)).length,
      });
    }

    const walletTotals: Record<string, number> = {};
    for (const w of (wallets.data ?? []) as any[]) {
      walletTotals[w.currency] = (walletTotals[w.currency] ?? 0) + Number(w.balance);
    }

    return {
      metrics: {
        totalUsers: P.length,
        newUsersToday: since(P, "created_at", day),
        signupsWeek: since(P, "created_at", week),
        signupsMonth: since(P, "created_at", month),
        totalDeposits: sum(D, (d) => d.status === "approved"),
        pendingDeposits: D.filter((d) => d.status === "pending").length,
        pendingWithdrawals: W.filter((w) => w.status === "pending").length,
        totalWithdrawals: sum(W, (w) => w.status === "approved"),
        revenue,
        activeTrades: C.filter((c) => c.status === "open").length,
        pendingKyc: K.filter((k) => k.status === "pending").length,
        // Only genuinely open tickets count — resolved/closed drop out instantly.
        openTickets: (ticketRows.data ?? []).filter((t: any) => t.status === "open").length,
      },
      series,
      contracts: C.slice(0, 120),
      tradeStats: {
        settled: settled.length,
        wins: settled.filter((c) => c.result === "win").length,
        losses: settled.filter((c) => c.result === "loss").length,
        volume: C.reduce((a, c) => a + Number(c.stake), 0),
      },
      ledger: [
        ...D.slice(0, 60).map((d) => ({
          id: d.id,
          kind: "deposit" as const,
          user_id: d.user_id,
          coin: d.coin,
          amount: Number(d.amount),
          status: d.status,
          created_at: d.created_at,
        })),
        ...W.slice(0, 60).map((w) => ({
          id: w.id,
          kind: "withdrawal" as const,
          user_id: w.user_id,
          coin: w.coin,
          amount: Number(w.amount),
          status: w.status,
          created_at: w.created_at,
        })),
        ...(swaps.data ?? []).map((s: any) => ({
          id: s.id,
          kind: "swap" as const,
          user_id: s.user_id,
          coin: `${s.from_currency}→${s.to_currency}`,
          amount: Number(s.from_amount),
          status: "approved",
          created_at: s.created_at,
        })),
      ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)),
      walletTotals,
      sessions: sessions.data ?? [],
      chats: chats.data ?? [],
      kycExpiring: K.filter(
        (k) =>
          k.document_expires_at &&
          new Date(k.document_expires_at).getTime() < now.getTime() + 30 * 864e5,
      ),
      referrals: P.filter((p) => p.referred_by).length,
      referralRewards: P.reduce((a, p) => a + Number(p.referral_rewards_usdt ?? 0), 0),
    };
  });

/* ------------------------------------------------------------------ */
/* Support desk: isolated chat inboxes + native ticketing              */
/* ------------------------------------------------------------------ */

/** Every user conversation with identity, last message preview and unread count. */
export const getSupportThreads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();

    const { data: sessions } = await db
      .from("chat_sessions")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(200);

    const rows: any[] = sessions ?? [];
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    if (userIds.length === 0) return [];

    const [profiles, kyc, messages] = await Promise.all([
      db.from("profiles").select("id,display_name,uid").in("id", userIds),
      db.from("kyc_submissions").select("user_id,full_name,status").in("user_id", userIds),
      db
        .from("chat_messages")
        .select("session_id,body,created_at,sender_role")
        .in(
          "session_id",
          rows.map((r) => r.id),
        )
        .order("created_at", { ascending: false })
        .limit(1000),
    ]);

    const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const kycMap = new Map((kyc.data ?? []).map((k: any) => [k.user_id, k]));
    const msgs: any[] = messages.data ?? [];

    return rows.map((s) => {
      const mine = msgs.filter((m) => m.session_id === s.id);
      const unread = mine.filter(
        (m) =>
          m.sender_role === "user" &&
          new Date(m.created_at).getTime() > new Date(s.agent_last_read_at ?? 0).getTime(),
      ).length;
      const profile: any = profileMap.get(s.user_id);
      const identity: any = kycMap.get(s.user_id);
      return {
        id: s.id,
        userId: s.user_id,
        subject: s.subject,
        status: s.status,
        lastMessageAt: s.last_message_at,
        preview: mine[0]?.body ?? null,
        unread,
        displayName: profile?.display_name ?? "Trader",
        legalName: identity?.full_name ?? null,
        kycStatus: identity?.status ?? "unverified",
        uid: profile?.uid ?? null,
      };
    });
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("chat_messages")
      .select("*")
      .eq("session_id", data.sessionId)
      .order("created_at");
    await db
      .from("chat_sessions")
      .update({ agent_last_read_at: new Date().toISOString() })
      .eq("id", data.sessionId);
    return rows ?? [];
  });

export const sendAgentMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ sessionId: z.string().uuid(), body: z.string().trim().min(1).max(2000) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("chat_messages").insert({
      session_id: data.sessionId,
      sender_id: context.userId,
      sender_role: "agent",
      body: data.body,
    });
    if (error) throw new Error(error.message);
    await db
      .from("chat_sessions")
      .update({
        last_message_at: new Date().toISOString(),
        agent_last_read_at: new Date().toISOString(),
        status: "open",
      })
      .eq("id", data.sessionId);
    return { ok: true };
  });

export const setThreadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ sessionId: z.string().uuid(), status: z.enum(["open", "closed"]) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db
      .from("chat_sessions")
      .update({ status: data.status })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSupportTickets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: tickets } = await db
      .from("support_tickets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows: any[] = tickets ?? [];
    if (rows.length === 0) return { tickets: [], messages: [] };

    const [profiles, kyc, messages, agentProfiles] = await Promise.all([
      db.from("profiles").select("id,display_name,uid").in("id", [...new Set(rows.map((t) => t.user_id))]),
      db.from("kyc_submissions").select("user_id,full_name").in("user_id", [...new Set(rows.map((t) => t.user_id))]),
      db
        .from("support_ticket_messages")
        .select("*")
        .in("ticket_id", rows.map((t) => t.id))
        .order("created_at"),
      db.from("agent_profiles").select("user_id,full_name,agent_role"),
    ]);

    const profileMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const kycMap = new Map((kyc.data ?? []).map((k: any) => [k.user_id, k]));
    const agentMap = new Map((agentProfiles.data ?? []).map((a: any) => [a.user_id, a]));

    const msgs = messages.data ?? [];
    return {
      tickets: rows.map((t) => ({
        ...t,
        displayName: (profileMap.get(t.user_id) as any)?.display_name ?? "Trader",
        uid: (profileMap.get(t.user_id) as any)?.uid ?? null,
        legalName: (kycMap.get(t.user_id) as any)?.full_name ?? null,
        assignedAgentName:
          (agentMap.get(t.assigned_agent_id) as any)?.full_name ??
          (profileMap.get(t.assigned_agent_id) as any)?.display_name ??
          null,
        unread: msgs.filter(
          (m: any) =>
            m.ticket_id === t.id &&
            m.sender_role === "user" &&
            new Date(m.created_at) > new Date(t.admin_last_read_at ?? 0),
        ).length,
      })),
      messages: msgs,
    };
  });

/** Staff members who can own a ticket (admin, finance or agent roles). */
export const listSupportAgents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const [roles, agents, profiles] = await Promise.all([
      db.from("user_roles").select("user_id,role").in("role", ["admin", "finance", "agent"]),
      db.from("agent_profiles").select("user_id,full_name,agent_role"),
      db.from("profiles").select("id,display_name"),
    ]);
    const agentMap = new Map((agents.data ?? []).map((a: any) => [a.user_id, a]));
    const nameMap = new Map((profiles.data ?? []).map((p: any) => [p.id, p.display_name]));
    const seen = new Set<string>();
    const list: { id: string; name: string; role: string }[] = [];
    for (const r of roles.data ?? []) {
      if (seen.has(r.user_id)) continue;
      seen.add(r.user_id);
      const a: any = agentMap.get(r.user_id);
      list.push({
        id: r.user_id,
        name: a?.full_name ?? nameMap.get(r.user_id) ?? "Support agent",
        role: a?.agent_role ?? r.role,
      });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  });

/** Assignment, priority, category, resolution note and private internal notes. */
export const updateTicketFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        assignedAgentId: z.string().uuid().nullable().optional(),
        priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
        category: z.string().min(2).max(40).optional(),
        resolutionNote: z.string().max(2000).nullable().optional(),
        internalNotes: z.string().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const patch: Record<string, unknown> = {};
    if (data.assignedAgentId !== undefined) patch['assigned_agent_id'] = data.assignedAgentId;
    if (data.priority !== undefined) patch['priority'] = data.priority;
    if (data.category !== undefined) patch['category'] = data.category;
    if (data.resolutionNote !== undefined) patch['resolution_note'] = data.resolutionNote;
    if (data.internalNotes !== undefined) patch['internal_notes'] = data.internalNotes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await db.from("support_tickets").update(patch).eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Private note kept on the thread — never returned to the customer (RLS blocks it). */
export const addTicketInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticketId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: context.userId,
      sender_role: "agent",
      body: data.body,
      internal: true,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const markTicketRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ticketId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db
      .from("support_tickets")
      .update({ admin_last_read_at: new Date().toISOString() })
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


export const updateTicketStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: z.enum(["open", "in_progress", "pending", "waiting_customer", "resolved", "closed"]),
        resolutionNote: z.string().trim().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const patch: Record<string, unknown> = {
      status: data.status,
      admin_last_read_at: new Date().toISOString(),
    };
    if (data.resolutionNote) patch['resolution_note'] = data.resolutionNote;
    const { data: row, error } = await db
      .from("support_tickets")
      .update(patch)
      .eq("id", data.ticketId)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      const label =
        ({
          open: "Open",
          in_progress: "In Progress",
          pending: "Waiting for Customer",
          waiting_customer: "Waiting for Customer",
          resolved: "Resolved",
          closed: "Closed",
        } as Record<string, string>)[data.status] ?? data.status;
      await notify(
        db,
        row.user_id,
        `Ticket ${label}`,
        `Your ticket "${row.subject}"${row.reference ? ` (${row.reference})` : ""} is now marked ${label}.${
          data.resolutionNote ? ` ${data.resolutionNote}` : ""
        }`,
        data.status === "resolved" || data.status === "closed" ? "success" : "info",
      );
    }
    return { ok: true };
  });


/** Signed URL for a ticket attachment (staff only). Handles legacy chat-attachments paths. */
export const getTicketAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ path: z.string().min(1).max(400) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    for (const bucket of ["support-attachments", "chat-attachments"]) {
      const { data: signed } = await db.storage.from(bucket).createSignedUrl(data.path, 300);
      if (signed?.signedUrl) return { url: signed.signedUrl };
    }
    return { url: null };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        status: z
          .enum(["open", "in_progress", "waiting_customer", "resolved", "closed"])
          .optional(),
        attachment: z
          .object({
            path: z.string().min(1).max(400),
            name: z.string().min(1).max(200),
            type: z.string().max(120).optional(),
          })
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: ticket } = await db
      .from("support_tickets")
      .select("id,user_id,subject,reference,assigned_agent_id")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (!ticket) throw new Error("Ticket not found.");

    const { error } = await db.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: context.userId,
      sender_role: "agent",
      body: data.body,
      attachment_path: data.attachment?.path ?? null,
      attachment_name: data.attachment?.name ?? null,
      attachment_type: data.attachment?.type ?? null,
    });
    if (error) throw new Error(error.message);

    const now = new Date().toISOString();
    await db
      .from("support_tickets")
      .update({
        // Agent replies default to "in progress" (customer sees "Under Review");
        // staff only flip to waiting_customer when they explicitly need details.
        status: data.status ?? "in_progress",
        admin_last_read_at: now,
        last_response_at: now,
        // First responder takes ownership automatically.
        assigned_agent_id: (ticket as any).assigned_agent_id ?? context.userId,
      } as any)
      .eq("id", data.ticketId);
    await notify(
      db,
      ticket.user_id,
      "Support replied to your ticket",
      `${(ticket as any).reference ? `${(ticket as any).reference} · ` : ""}${ticket.subject}: ${data.body.slice(0, 200)}`,
      "info",
    );
    return { ok: true };
  });


/* ------------------------------------------------------------------ */
/* Roles, credit scores and audit logging                              */
/* ------------------------------------------------------------------ */

/** Directory of users with their roles, credit score and wallet totals. */
export const getUserDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();

    const [profiles, roles, kyc, wallets] = await Promise.all([
      db
        .from("profiles")
        .select(
          "id,display_name,uid,base_currency,credit_score,outcome_mode,created_at,referred_by,vip_tier",
        )
        .order("created_at", { ascending: false })
        .limit(500),
      db.from("user_roles").select("user_id,role"),
      db.from("kyc_submissions").select("user_id,status,full_name,created_at"),
      db.from("wallets").select("user_id,currency,balance"),
    ]);

    const roleMap = new Map<string, string[]>();
    for (const r of (roles.data ?? []) as any[]) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    const kycMap = new Map<string, any>();
    for (const k of (kyc.data ?? []) as any[]) {
      if (!kycMap.has(k.user_id)) kycMap.set(k.user_id, k);
    }
    const walletMap = new Map<string, { currency: string; balance: number }[]>();
    for (const w of (wallets.data ?? []) as any[]) {
      walletMap.set(w.user_id, [
        ...(walletMap.get(w.user_id) ?? []),
        { currency: w.currency, balance: Number(w.balance) },
      ]);
    }

    return ((profiles.data ?? []) as any[]).map((p) => ({
      id: p.id,
      displayName: p.display_name,
      uid: p.uid,
      baseCurrency: p.base_currency,
      creditScore: Number(p.credit_score ?? 750),
      outcomeMode: p.outcome_mode,
      createdAt: p.created_at,
      roles: roleMap.get(p.id) ?? ["user"],
      isAdmin: (roleMap.get(p.id) ?? []).includes("admin"),
      vipTier: (p.vip_tier ?? "regular") as string,
      kycStatus: kycMap.get(p.id)?.status ?? "unverified",
      legalName: kycMap.get(p.id)?.full_name ?? null,
      wallets: walletMap.get(p.id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "finance", "agent"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot revoke your own Control Center access.");
    }
    const db = await privileged();

    if (data.grant) {
      const { error } = await db
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await db
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    await writeAudit(context, data.grant ? "role.grant" : "role.revoke", data.userId, {
      role: data.role,
    });
    const permissionLabel = data.role === "admin" ? "Control Center" : data.role;
    await notify(
      db,
      data.userId,
      data.grant ? `Granted ${permissionLabel} access` : `Revoked ${permissionLabel} access`,
      `Security Operations ${data.grant ? "granted" : "revoked"} your ${permissionLabel} permissions.`,
      "info",
    );
    return { ok: true };
  });

export const setUserCreditScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        score: z.number().int().min(300).max(850),
        note: z.string().trim().max(300).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db
      .from("profiles")
      .update({ credit_score: data.score })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);

    await writeAudit(context, "credit_score.update", data.userId, {
      score: data.score,
      note: data.note ?? null,
    });
    await notify(
      db,
      data.userId,
      "Credit score updated",
      `Your account credit score is now ${data.score}.${data.note ? ` Note: ${data.note}` : ""}`,
      "info",
    );
    return { ok: true };
  });

export const getAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data } = await db
      .from("admin_audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });

/* ------------------------------------------------------------------ */
/* Permanent user deletion (cascade purge)                             */
/* ------------------------------------------------------------------ */

const USER_TABLES = [
  "contracts",
  "positions",
  "swaps",
  "watchlist",
  "deposits",
  "withdrawals",
  "kyc_submissions",
  "notifications",
  "user_sessions",
  "consent_records",
  "chat_ratings",
  "user_roles",
  "agent_profiles",
  "wallets",
] as const;

async function purgeBucket(db: any, bucket: string, prefix: string) {
  const { data } = await db.storage.from(bucket).list(prefix, { limit: 1000 });
  const paths = (data ?? []).map((f: any) => `${prefix}/${f.name}`);
  if (paths.length) await db.storage.from(bucket).remove(paths);
}

/** Irreversibly removes a user and every record attached to them. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    const db = await privileged();

    const { data: profile } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", data.userId)
      .maybeSingle();

    // Conversations and tickets carry child message rows.
    const { data: sessions } = await db
      .from("chat_sessions")
      .select("id")
      .eq("user_id", data.userId);
    const sessionIds = (sessions ?? []).map((s: any) => s.id);
    if (sessionIds.length) {
      await db.from("chat_messages").delete().in("session_id", sessionIds);
      await db.from("chat_sessions").delete().in("id", sessionIds);
    }

    const { data: tickets } = await db
      .from("support_tickets")
      .select("id")
      .eq("user_id", data.userId);
    const ticketIds = (tickets ?? []).map((t: any) => t.id);
    if (ticketIds.length) {
      await db.from("support_ticket_messages").delete().in("ticket_id", ticketIds);
      await db.from("support_tickets").delete().in("id", ticketIds);
    }

    for (const table of USER_TABLES) {
      await db.from(table).delete().eq("user_id", data.userId);
    }

    // Uploaded documents are stored under a per-user folder in each bucket.
    for (const bucket of ["kyc-documents", "deposit-proofs", "chat-attachments"]) {
      try {
        await purgeBucket(db, bucket, data.userId);
      } catch {
        /* bucket may not contain a folder for this user */
      }
    }

    await db.from("profiles").update({ referred_by: null }).eq("referred_by", data.userId);
    await db.from("profiles").delete().eq("id", data.userId);

    const { error } = await db.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      action: "user.delete",
      target_user_id: null,
      details: { userId: data.userId, displayName: profile?.display_name ?? null },
    });

    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* KYC reversal and platform settings hub                              */
/* ------------------------------------------------------------------ */

/** Reverts an approved identity verification back to pending. */
export const unverifyKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), note: z.string().trim().max(300).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: row, error } = await db
      .from("kyc_submissions")
      .update({
        status: "pending",
        admin_note: data.note ?? "Verification revoked — re-review required.",
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (row) {
      await writeAudit(context, "kyc.unverify", row.user_id, { note: data.note ?? null });
      await notify(
        db,
        row.user_id,
        "Identity verification revoked",
        data.note ?? "Your verified status was reverted to pending. Please re-submit if requested.",
        "warning",
      );
    }
    return { ok: true };
  });

/** Reads one or more platform settings blobs (admin only). */
export const getPlatformSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ keys: z.array(z.string().min(1).max(60)).min(1).max(20) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("platform_settings")
      .select("key,value")
      .in("key", data.keys);
    const out: Record<string, any> = {};
    for (const r of (rows ?? []) as any[]) out[r.key] = r.value ?? {};
    return out;
  });

/** Persists a platform settings blob (admin only). */
export const savePlatformSetting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ key: z.string().min(1).max(60), value: z.record(z.any()) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db
      .from("platform_settings")
      .upsert({ key: data.key, value: data.value }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await writeAudit(context, "settings.update", null, { key: data.key });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Read-only "Inspect user workspace" snapshot (support view-as mode)   */
/* ------------------------------------------------------------------ */

/** Read-only portfolio/balance snapshot of a single user for support inquiries. */
export const getUserWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const uid = data.userId;

    const [profile, wallets, positions, contracts, deposits, withdrawals, sessions, kyc] =
      await Promise.all([
        db.from("profiles").select("*").eq("id", uid).maybeSingle(),
        db.from("wallets").select("currency,balance").eq("user_id", uid).order("currency"),
        db
          .from("positions")
          .select("id,display_symbol,side,quantity,entry_price,leverage,status,opened_at")
          .eq("user_id", uid)
          .order("opened_at", { ascending: false })
          .limit(25),
        db
          .from("contracts")
          .select("id,display_symbol,direction,stake,currency,status,result,payout,opened_at")
          .eq("user_id", uid)
          .order("opened_at", { ascending: false })
          .limit(25),
        db
          .from("deposits")
          .select("id,coin,amount,status,created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(15),
        db
          .from("withdrawals")
          .select("id,coin,amount,status,created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(15),
        db
          .from("user_sessions")
          .select("browser,os,ip_address,country,last_active_at")
          .eq("user_id", uid)
          .order("last_active_at", { ascending: false })
          .limit(8),
        db
          .from("kyc_submissions")
          .select("status,full_name,country,created_at")
          .eq("user_id", uid)
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

    await writeAudit(context, "user.inspect", uid, { mode: "read-only" });

    return {
      profile: profile.data ?? null,
      wallets: wallets.data ?? [],
      positions: positions.data ?? [],
      contracts: contracts.data ?? [],
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
      sessions: sessions.data ?? [],
      kyc: (kyc.data ?? [])[0] ?? null,
    };
  });
