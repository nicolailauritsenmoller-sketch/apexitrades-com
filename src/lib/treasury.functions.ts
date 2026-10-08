import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, privileged } from "@/lib/desk.server";

/** Treasury balances, recent ledger and a customer directory for the picker. */
export const getTreasury = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertFinance(context);
    const db = await privileged();
    const [wallets, ledger, profiles] = await Promise.all([
      db.from("treasury_wallets").select("*").order("currency"),
      db.from("treasury_ledger").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("profiles").select("id,display_name,email,uid").order("created_at", { ascending: false }).limit(1000),
    ]);
    const pmap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    return {
      wallets: wallets.data ?? [],
      ledger: (ledger.data ?? []).map((l: any) => ({
        ...l,
        counterparty: l.counterparty_user_id ? pmap.get(l.counterparty_user_id) ?? null : null,
      })),
      profiles: profiles.data ?? [],
    };
  });

/** Balance of one customer's wallet in a currency (for the transfer form). */
export const getUserWalletBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ userId: z.string().uuid(), currency: z.string().min(2).max(10) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const db = await privileged();
    const { data: w } = await db
      .from("wallets")
      .select("balance")
      .eq("user_id", data.userId)
      .eq("currency", data.currency.toUpperCase())
      .maybeSingle();
    return { balance: Number(w?.balance ?? 0) };
  });

/** Atomic treasury movement: send to / receive from a customer, or fund / withdraw the treasury itself. */
export const treasuryTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        direction: z.enum(["send", "receive", "fund", "withdraw"]),
        userId: z.string().uuid().nullable(),
        currency: z.string().trim().min(2).max(10),
        amount: z.number().positive().max(1e12),
        reason: z.string().trim().min(5).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    if ((data.direction === "send" || data.direction === "receive") && !data.userId) {
      throw new Error("Choose a customer account.");
    }
    const db = await privileged();
    const { data: me } = await db.from("profiles").select("display_name").eq("id", context.userId).maybeSingle();
    const currency = data.currency.toUpperCase();
    const { data: res, error } = await db.rpc("treasury_transfer" as any, {
      p_direction: data.direction,
      p_user: data.userId,
      p_currency: currency,
      p_amount: data.amount,
      p_reason: data.reason,
      p_actor: context.userId,
      p_actor_name: me?.display_name ?? null,
    });
    if (error) {
      const m = error.message;
      throw new Error(
        m.includes("Insufficient treasury") ? "The treasury does not hold enough of this currency."
        : m.includes("Insufficient balance") ? "The customer does not hold enough of this currency."
        : m,
      );
    }
    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_name: me?.display_name ?? null,
      action: `treasury.${data.direction}`,
      target_user_id: data.userId,
      details: { currency, amount: data.amount, reason: data.reason, result: res },
    } as any);
    if (data.userId && (data.direction === "send" || data.direction === "receive")) {
      await db.from("notifications").insert({
        user_id: data.userId,
        title: data.direction === "send" ? "Funds received" : "Balance debited",
        body: `${data.direction === "send" ? "Account Operations credited" : "Account Operations debited"} ${data.amount} ${currency}. Reason: ${data.reason}`,
        kind: data.direction === "send" ? "success" : "warning",
      });
    }
    return res as { id: string; treasury_balance: number; user_balance: number | null };
  });
