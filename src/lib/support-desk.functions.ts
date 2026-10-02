import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertStaff, logAudit, privileged } from "./desk.server";

export const DEPARTMENTS = ["support", "compliance", "risk"] as const;
export const DEPARTMENT_LABEL: Record<string, string> = {
  support: "Support",
  compliance: "Compliance",
  risk: "Risk Management",
  account_manager: "Account Manager",
};

/** Live identity, verification and risk snapshot for the customer in an open chat. */
export const getChatUserContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { usdtRates } = await import("./rates.server");
    const [profile, kyc, sec, positions, wallets, logs, rates] = await Promise.all([
      db
        .from("profiles")
        .select(
          "display_name,email,uid,trader_trust_score,trust_score_override,withdrawals_disabled,trading_frozen,margin_restricted",
        )
        .eq("id", data.userId)
        .maybeSingle(),
      db
        .from("kyc_submissions")
        .select("full_name,status,level2_status")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("user_security").select("two_factor_enabled").eq("user_id", data.userId).maybeSingle(),
      db
        .from("positions")
        .select("quantity,entry_price,leverage,currency")
        .eq("user_id", data.userId)
        .eq("status", "open"),
      db.from("wallets").select("currency,balance").eq("user_id", data.userId),
      db
        .from("security_logs")
        .select("id,event,detail,ip_address,created_at")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(15),
      usdtRates(),
    ]);
    const p: any = profile.data ?? {};
    const k: any = kyc.data;
    const spot = (wallets.data ?? []).reduce(
      (s: number, w: any) => s + Number(w.balance) * (rates[w.currency] ?? 0),
      0,
    );
    const used = (positions.data ?? [])
      .filter((x: any) => Number(x.leverage) > 1)
      .reduce(
        (s: number, x: any) =>
          s +
          ((Number(x.quantity) * Number(x.entry_price)) / Math.max(Number(x.leverage), 1)) *
            (rates[x.currency] ?? 0),
        0,
      );
    const util = used > 0 && used + spot > 0 ? (used / (used + spot)) * 100 : 0;
    const exposure =
      used <= 0 ? "None" : util < 25 ? "Low" : util < 50 ? "Moderate" : util < 75 ? "Elevated" : "High";
    const tier =
      k?.level2_status === "approved"
        ? "KYC Level 2"
        : k?.status === "approved"
          ? "KYC Level 1"
          : k?.status === "pending"
            ? "KYC Level 1 (pending)"
            : "Unverified";
    return {
      uid: (p.uid as string | null) ?? null,
      fullName: (k?.full_name as string | null) ?? (p.display_name as string | null) ?? null,
      email: (p.email as string | null) ?? null,
      kycTier: tier,
      healthPct: Math.round(Math.max(0, 100 - util) * 10) / 10,
      trustPct: Number(p.trust_score_override ?? p.trader_trust_score ?? 0),
      exposure,
      twoFactor: Boolean((sec.data as any)?.two_factor_enabled),
      withdrawalsDisabled: Boolean(p.withdrawals_disabled),
      tradingFrozen: Boolean(p.trading_frozen),
      marginRestricted: Boolean(p.margin_restricted),
      securityLogs: (logs.data ?? []) as {
        id: string;
        event: string;
        detail: string | null;
        ip_address: string | null;
        created_at: string;
      }[],
    };
  });

/** Staff-only note inside a conversation; never visible to the customer. */
export const addChatInternalNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("chat_messages").insert({
      session_id: data.sessionId,
      sender_id: context.userId,
      sender_role: "agent",
      body: data.body,
      is_internal: true,
      read_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Move a conversation to another department and release the agent lock. */
export const transferChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ sessionId: z.string().uuid(), department: z.enum(DEPARTMENTS) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: s } = await db
      .from("chat_sessions")
      .select("active_agent_id,department,status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!s) throw new Error("Conversation not found.");
    if (s.active_agent_id && s.active_agent_id !== context.userId) {
      throw new Error("Only the assigned agent can transfer this conversation.");
    }
    const now = new Date().toISOString();
    const { error } = await db
      .from("chat_sessions")
      .update({
        department: data.department,
        active_agent_id: null,
        connected_at: null,
        escalated_at: s.status === "closed" ? undefined : now,
        status: s.status === "closed" ? "closed" : "pending",
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    await db.from("chat_messages").insert({
      session_id: data.sessionId,
      sender_id: context.userId,
      sender_role: "agent",
      body: `Transferred from ${DEPARTMENT_LABEL[s.department] ?? s.department} to ${DEPARTMENT_LABEL[data.department]}.`,
      is_internal: true,
      read_at: now,
    });
    return { ok: true };
  });

/** Clear the customer's authenticator so they can enrol a new device. */
export const resetUserTwoFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db
      .from("user_security")
      .update({
        two_factor_enabled: false,
        totp_secret: null,
        pending_totp_secret: null,
        two_factor_verified_at: null,
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("user_id", data.userId);
    if (error) throw new Error(error.message);
    await db.from("user_recovery_codes").delete().eq("user_id", data.userId);
    await db.from("security_logs").insert({
      user_id: data.userId,
      event: "2fa_reset_by_support",
      detail: "Two-factor authentication reset by support desk.",
    });
    await db.from("notifications").insert({
      user_id: data.userId,
      title: "Two-factor authentication reset",
      body: "Your authenticator was reset by Velocity Support. Enrol a new device from Security settings.",
      kind: "warning",
    });
    await logAudit(db, context.userId, "user.2fa_reset", data.userId, {});
    return { ok: true };
  });
