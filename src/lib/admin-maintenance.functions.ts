import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";

export const MAINTENANCE_SCOPES = ["chat", "trades", "transactions", "notifications"] as const;
export type MaintenanceScope = (typeof MAINTENANCE_SCOPES)[number];

const Input = z.object({
  userId: z.string().uuid(),
  scopes: z.array(z.enum(MAINTENANCE_SCOPES)).min(1),
  confirm: z.literal("RESET"),
});

/**
 * Wipes a user's activity history (chat, trades, transactions) while leaving
 * every balance table (wallets / profiles) completely untouched.
 */
export const resetUserActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const uid = data.userId;
    const scopes = new Set<MaintenanceScope>(data.scopes);
    const removed: Record<string, number> = {};

    const wipe = async (table: string, column: string, value: string) => {
      const { data: rows, error } = await db
        .from(table)
        .delete()
        .eq(column, value)
        .select("id");
      if (error) throw new Error(`${table}: ${error.message}`);
      removed[table] = (removed[table] ?? 0) + (rows?.length ?? 0);
    };

    if (scopes.has("chat")) {
      const { data: sessions } = await db.from("chat_sessions").select("id").eq("user_id", uid);
      const sessionIds = ((sessions ?? []) as { id: string }[]).map((s) => s.id);
      if (sessionIds.length) {
        const { data: msgs } = await db
          .from("chat_messages")
          .delete()
          .in("session_id", sessionIds)
          .select("id");
        removed["chat_messages"] = msgs?.length ?? 0;
      }

      const { data: tickets } = await db.from("support_tickets").select("id").eq("user_id", uid);
      const ticketIds = ((tickets ?? []) as { id: string }[]).map((t) => t.id);
      if (ticketIds.length) {
        const { data: tmsgs } = await db
          .from("support_ticket_messages")
          .delete()
          .in("ticket_id", ticketIds)
          .select("id");
        removed["support_ticket_messages"] = tmsgs?.length ?? 0;
      }

      await wipe("chat_ratings", "user_id", uid);
      await wipe("chat_sessions", "user_id", uid);
      await wipe("support_tickets", "user_id", uid);
      await wipe("vip_messages", "user_id", uid);
      await wipe("security_reports", "user_id", uid);
    }

    if (scopes.has("trades")) {
      await wipe("contracts", "user_id", uid);
      await wipe("positions", "user_id", uid);
    }

    if (scopes.has("transactions")) {
      await wipe("deposits", "user_id", uid);
      await wipe("withdrawals", "user_id", uid);
      await wipe("swaps", "user_id", uid);
    }

    if (scopes.has("notifications")) {
      // Wiping the notifications table also zeroes the unread badge counter.
      await wipe("notifications", "user_id", uid);
    }

    // Balances are never touched - wallets and profiles are intentionally excluded.
    const { data: me } = await db
      .from("profiles")
      .select("display_name")
      .eq("id", context.userId)
      .maybeSingle();

    await db.from("admin_audit_logs").insert({
      actor_id: context.userId,
      actor_name: (me as { display_name?: string } | null)?.display_name ?? null,
      action: "account_maintenance_reset",
      target_user_id: uid,
      details: { scopes: [...scopes], removed, balances_preserved: true },
    });

    return { ok: true as const, removed };
  });

export const SUPPORT_HISTORY_CATEGORIES = ["live_chat", "priority_support", "tickets"] as const;
export const SUPPORT_HISTORY_AUDIENCES = ["both", "staff", "customer"] as const;

const ClearSupportInput = z.object({
  categories: z.array(z.enum(SUPPORT_HISTORY_CATEGORIES)).min(1),
  audience: z.enum(SUPPORT_HISTORY_AUDIENCES),
  userId: z.string().uuid().nullable(),
  confirm: z.literal("CLEAR"),
});

/**
 * Clears support history. "both" permanently deletes; "staff" / "customer"
 * hides it from just that side. Optionally limited to one user.
 */
export const clearSupportHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ClearSupportInput.parse(data))
  .handler(async ({ data, context }) => {
    const { assertStaff, logAudit } = await import("@/lib/desk.server");
    await assertStaff(context);
    const db: any = await privileged();
    const now = new Date().toISOString();
    const column = data.audience === "staff" ? "hidden_from_staff_at" : "hidden_from_customer_at";
    const affected: Record<string, number> = {};
    const scope = (q: any, col = "user_id") => (data.userId ? q.eq(col, data.userId) : q.not("id", "is", null));

    const ids = async (table: string) => {
      const { data: rows, error } = await scope(db.from(table).select("id"));
      if (error) throw new Error(`${table}: ${error.message}`);
      return ((rows ?? []) as { id: string }[]).map((r) => r.id);
    };
    const apply = async (table: string, build: (q: any) => any) => {
      const base = data.audience === "both" ? db.from(table).delete() : db.from(table).update({ [column]: now });
      const { data: rows, error } = await build(base).select("id");
      if (error) throw new Error(`${table}: ${error.message}`);
      affected[table] = (affected[table] ?? 0) + (rows?.length ?? 0);
    };
    const chunks = (list: string[]) => Array.from({ length: Math.ceil(list.length / 200) }, (_, i) => list.slice(i * 200, i * 200 + 200));

    const cats = new Set(data.categories);
    if (cats.has("live_chat")) {
      const sessionIds = await ids("chat_sessions");
      for (const part of chunks(sessionIds)) {
        await apply("chat_messages", (q) => q.in("session_id", part));
        if (data.audience === "both") await apply("chat_ratings", (q) => q.in("session_id", part));
      }
      await apply("chat_sessions", (q) => scope(q));
    }
    if (cats.has("tickets")) {
      const ticketIds = await ids("support_tickets");
      for (const part of chunks(ticketIds)) await apply("support_ticket_messages", (q) => q.in("ticket_id", part));
      await apply("support_tickets", (q) => scope(q));
    }
    if (cats.has("priority_support")) {
      await apply("vip_messages", (q) => scope(q));
      if (data.audience !== "customer") await apply("vip_access", (q) => scope(q));
    }

    await logAudit(db, context.userId, "support.history_cleared", data.userId, {
      categories: data.categories,
      audience: data.audience,
      affected,
    }).catch(() => undefined);
    return { affected };
  });
