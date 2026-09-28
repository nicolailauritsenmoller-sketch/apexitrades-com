import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertStaff, logAudit, privileged } from "@/lib/desk.server";

/* ----------------------------- agent profiles ---------------------------- */

export const getMyAgentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const { data } = await context.supabase
      .from("agent_profiles")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data ?? null;
  });

export const saveMyAgentProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        fullName: z.string().trim().min(2).max(80),
        agentRole: z.string().trim().min(2).max(60),
        staffId: z.string().trim().min(2).max(40),
        avatarUrl: z.string().trim().url().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("agent_profiles").upsert(
      {
        user_id: context.userId,
        full_name: data.fullName,
        agent_role: data.agentRole,
        staff_id: data.staffId,
        avatar_url: data.avatarUrl ?? null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------------- chat --------------------------------- */

const botContextSchema = z.object({
  requestedWith: z.string().trim().max(1000).nullable().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["bot", "user"]),
        text: z.string().trim().min(1).max(4000),
      }),
    )
    .max(24),
});

/** Queue the caller's own chat once and retain the bot context privately for staff. */
export const requestLiveAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        context: botContextSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: session } = await db
      .from("chat_sessions")
      .select("id,user_id,status,escalated_at,connected_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session || session.user_id !== context.userId) throw new Error("Session not found.");

    if (session.escalated_at && session.status !== "closed") {
      return {
        queuedAt: session.escalated_at,
        connectedAt: session.connected_at,
        alreadyQueued: true,
      };
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from("chat_sessions")
      .update({
        bot_context: data.context,
        escalated_at: now,
        connected_at: null,
        active_agent_id: null,
        last_message_at: now,
        status: "pending",
        subject: "Live support requested",
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { queuedAt: now, connectedAt: null, alreadyQueued: false };
  });

/** Explicitly claim a queued live chat before direct agent messaging starts. */
export const acceptLiveChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: session } = await db
      .from("chat_sessions")
      .select("id,status,active_agent_id,connected_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Conversation not found.");
    if (session.active_agent_id && session.active_agent_id !== context.userId) {
      throw new Error("This conversation is already assigned to another support agent.");
    }
    if (session.active_agent_id === context.userId && session.connected_at) {
      return { connectedAt: session.connected_at, alreadyAccepted: true };
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from("chat_sessions")
      .update({
        active_agent_id: context.userId,
        connected_at: now,
        status: "open",
        agent_last_read_at: now,
      })
      .eq("id", data.sessionId);
    if (error) throw new Error(error.message);
    return { connectedAt: now, alreadyAccepted: false };
  });

export const sendAgentChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid(),
        body: z.string().trim().max(2000),
        attachmentPath: z.string().trim().max(400).nullable().optional(),
        attachmentName: z.string().trim().max(200).nullable().optional(),
        attachmentType: z.string().trim().max(120).nullable().optional(),
      })
      .refine((v) => v.body.length > 0 || !!v.attachmentPath, {
        message: "Message or attachment required.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const now = new Date().toISOString();
    const { data: session } = await db
      .from("chat_sessions")
      .select("active_agent_id,connected_at,status")
      .eq("id", data.sessionId)
      .maybeSingle();
    if (!session) throw new Error("Conversation not found.");
    const isClosed = session.status === "closed";
    // Live sessions must be accepted first; closed tickets accept async follow-ups
    // that are queued and delivered on the user's next visit.
    if (!isClosed && (!session.active_agent_id || !session.connected_at)) {
      throw new Error("Accept this conversation before replying.");
    }
    if (!isClosed && session.active_agent_id !== context.userId) {
      throw new Error("This conversation is assigned to another support agent.");
    }
    const { error } = await db.from("chat_messages").insert({
      session_id: data.sessionId,
      sender_id: context.userId,
      sender_role: "agent",
      body: data.body || (data.attachmentName ?? "Attachment"),
      attachment_path: data.attachmentPath ?? null,
      attachment_name: data.attachmentName ?? null,
      attachment_type: data.attachmentType ?? null,
    });
    if (error) throw new Error(error.message);

    // Mark the user's messages as read (double tick on their side) and claim the thread.
    await db
      .from("chat_messages")
      .update({ read_at: now })
      .eq("session_id", data.sessionId)
      .eq("sender_role", "user")
      .is("read_at", null);

    await db
      .from("chat_sessions")
      .update(
        isClosed
          ? { last_message_at: now, agent_last_read_at: now }
          : {
              last_message_at: now,
              agent_last_read_at: now,
              active_agent_id: context.userId,
              status: "open",
            },
      )
      .eq("id", data.sessionId);
    return { ok: true };
  });

export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const now = new Date().toISOString();
    await db
      .from("chat_messages")
      .update({ read_at: now })
      .eq("session_id", data.sessionId)
      .eq("sender_role", "user")
      .is("read_at", null);
    await db.from("chat_sessions").update({ agent_last_read_at: now }).eq("id", data.sessionId);
    return { ok: true };
  });

/** Signed URL for a chat attachment - staff for any thread, users for their own. */
export const getChatAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: message } = await db
      .from("chat_messages")
      .select("id,session_id,attachment_path")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!message?.attachment_path) return { url: null };

    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const staff = (roles ?? []).some((r: any) => r.role === "admin" || r.role === "agent");

    if (!staff) {
      const { data: session } = await db
        .from("chat_sessions")
        .select("user_id")
        .eq("id", message.session_id)
        .maybeSingle();
      if (!session || session.user_id !== context.userId) throw new Error("Not found.");
    }

    const { data: signed } = await db.storage
      .from("chat-attachments")
      .createSignedUrl(message.attachment_path, 900);
    return { url: signed?.signedUrl ?? null };
  });

/**
 * User-side companion: returns the agent persona assigned to the caller's chat
 * session and marks the agent's messages as read for delivery receipts.
 */
export const getMyChatContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: session } = await db
      .from("chat_sessions")
      .select("id,user_id,status,active_agent_id,escalated_at,connected_at")
      .eq("id", data.sessionId)
      .maybeSingle();
    // A session can be replaced while an older modal subscription is still
    // winding down. Return an inert state instead of turning that race into an
    // unhandled client error; ownership failures reveal no session details.
    if (!session || session.user_id !== context.userId) {
      return {
        agent: null,
        status: "missing",
        queuedAt: null,
        connectedAt: null,
      };
    }

    const now = new Date().toISOString();
    await db
      .from("chat_messages")
      .update({ read_at: now })
      .eq("session_id", data.sessionId)
      .neq("sender_role", "user")
      .eq("is_internal", false)
      .is("read_at", null);
    await db.from("chat_sessions").update({ user_last_read_at: now }).eq("id", data.sessionId);

    if (!session.active_agent_id) {
      return {
        agent: null,
        status: session.status,
        queuedAt: session.escalated_at,
        connectedAt: session.connected_at,
      };
    }
    const { data: agent } = await db
      .from("agent_profiles")
      .select("full_name,agent_role,staff_id,avatar_url")
      .eq("user_id", session.active_agent_id)
      .maybeSingle();
    return {
      status: session.status,
      queuedAt: session.escalated_at,
      connectedAt: session.connected_at,
      agent: agent
        ? {
            name: agent.full_name,
            role: agent.agent_role,
            staffId: agent.staff_id,
            avatarUrl: agent.avatar_url,
          }
        : null,
    };
  });

/* -------------------------------- ratings -------------------------------- */

export const submitChatRating = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sessionId: z.string().uuid().nullable().optional(),
        stars: z.number().int().min(1).max(5),
        feedback: z.string().trim().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await privileged();
    let agentId: string | null = null;
    if (data.sessionId) {
      const { data: session } = await db
        .from("chat_sessions")
        .select("user_id,active_agent_id")
        .eq("id", data.sessionId)
        .maybeSingle();
      if (!session || session.user_id !== context.userId) throw new Error("Session not found.");
      agentId = session.active_agent_id ?? null;
    }
    let agentName: string | null = null;
    let agentRole: string | null = null;
    if (agentId) {
      const { data: agent } = await db
        .from("agent_profiles")
        .select("full_name,agent_role")
        .eq("user_id", agentId)
        .maybeSingle();
      agentName = agent?.full_name ?? null;
      agentRole = agent?.agent_role ?? null;
    }
    const { error } = await db.from("chat_ratings").insert({
      session_id: data.sessionId ?? null,
      user_id: context.userId,
      agent_id: agentId,
      agent_name: agentName,
      agent_role: agentRole,
      stars: data.stars,
      feedback: data.feedback?.length ? data.feedback : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getChatRatings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("chat_ratings")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    const list: any[] = rows ?? [];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,display_name,uid").in("id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    const average = list.length ? list.reduce((a, r) => a + Number(r.stars), 0) / list.length : 0;
    return {
      average,
      total: list.length,
      rows: list.map((r) => ({
        id: r.id,
        stars: r.stars,
        feedback: r.feedback,
        createdAt: r.created_at,
        agentName: r.agent_name,
        agentRole: r.agent_role,
        userName: (map.get(r.user_id) as any)?.display_name ?? "Trader",
        userUid: (map.get(r.user_id) as any)?.uid ?? r.user_id.slice(0, 8),
      })),
    };
  });

/* ------------------------------ active users ----------------------------- */

export const getActiveUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const activeSince = Date.now() - 15 * 60_000;
    const { data: rows } = await db
      .from("user_sessions")
      .select("*")
      .gte("last_active_at", new Date(Date.now() - 24 * 3600_000).toISOString())
      .order("last_active_at", { ascending: false })
      .limit(200);
    const list: any[] = rows ?? [];
    const ids = [...new Set(list.map((r) => r.user_id))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,display_name,uid").in("id", ids)
      : { data: [] };
    const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // KYC-verified users get a green badge in the monitoring table.
    const { data: kyc } = ids.length
      ? await db.from("kyc_submissions").select("user_id,status").in("user_id", ids)
      : { data: [] };
    const verified = new Set(
      (kyc ?? []).filter((k: any) => k.status === "approved").map((k: any) => k.user_id),
    );

    const emails = new Map<string, string>();
    try {
      const { data: users } = await (db as any).auth.admin.listUsers({ page: 1, perPage: 1000 });
      for (const u of users?.users ?? []) emails.set(u.id, u.email ?? "");
    } catch {
      /* email lookup is best-effort */
    }

    const mapped = list.map((s) => {
      const active = new Date(s.last_active_at).getTime() >= activeSince;
      return {
        id: s.id,
        userId: s.user_id,
        name: (map.get(s.user_id) as any)?.display_name ?? "Trader",
        uid: (map.get(s.user_id) as any)?.uid ?? s.user_id.slice(0, 8),
        email: emails.get(s.user_id) ?? null,
        verified: verified.has(s.user_id),
        browser: s.browser,
        os: s.os,
        device: /iOS|Android/i.test(s.os ?? "") ? "Mobile" : "Desktop",
        ip: s.ip_address,
        country: s.country,
        path: s.current_path,
        loginAt: s.created_at,
        lastActiveAt: s.last_active_at,
        active,
      };
    });

    return {
      count: new Set(mapped.filter((r) => r.active).map((r) => r.userId)).size,
      rows: mapped.filter((r) => r.active),
      recent: mapped.slice(0, 60),
    };
  });


/* --------------------------- trades & corrections ------------------------ */

export const getDeskTrades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const [contracts, positions, profiles] = await Promise.all([
      db.from("contracts").select("*").order("opened_at", { ascending: false }).limit(120),
      db.from("positions").select("*").order("opened_at", { ascending: false }).limit(120),
      db.from("profiles").select("id,display_name,uid").limit(500),
    ]);
    const map = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const named = (r: any) => ({
      ...r,
      userName: (map.get(r.user_id) as any)?.display_name ?? "Trader",
      userUid: (map.get(r.user_id) as any)?.uid ?? r.user_id.slice(0, 8),
    });
    return {
      contracts: (contracts.data ?? []).map(named),
      positions: (positions.data ?? []).map(named),
    };
  });

async function creditWallet(db: any, userId: string, currency: string, delta: number) {
  if (!delta) return;
  const { data: wallet } = await db
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .eq("currency", currency)
    .maybeSingle();
  if (!wallet) return;
  await db
    .from("wallets")
    .update({ balance: Number(wallet.balance) + delta })
    .eq("user_id", userId)
    .eq("currency", currency);
}

/** Edit or force-settle a fixed-time contract; wallet balance is reconciled. */
export const correctContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        entryPrice: z.number().positive().optional(),
        exitPrice: z.number().positive().optional(),
        payout: z.number().min(0).optional(),
        result: z.enum(["win", "loss", "draw"]).optional(),
        settle: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: contract } = await db
      .from("contracts")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!contract) throw new Error("Contract not found.");

    const patch: Record<string, unknown> = {};
    if (data.entryPrice !== undefined) patch["entry_price"] = data.entryPrice;
    if (data.exitPrice !== undefined) patch["exit_price"] = data.exitPrice;
    if (data.result !== undefined) patch["result"] = data.result;

    const previousPayout = Number(contract.payout ?? 0);
    let nextPayout = previousPayout;

    if (data.settle || data.result !== undefined || data.payout !== undefined) {
      const stake = Number(contract.stake);
      const pct = Number(contract.payout_pct);
      const result = data.result ?? contract.result ?? "loss";
      nextPayout =
        data.payout !== undefined
          ? data.payout
          : result === "win"
            ? stake + (stake * pct) / 100
            : result === "draw"
              ? stake
              : 0;
      patch["payout"] = nextPayout;
      patch["result"] = result;
      patch["status"] = "settled";
      patch["settled_at"] = new Date().toISOString();
      if (data.exitPrice === undefined && contract.exit_price == null) {
        patch["exit_price"] = Number(contract.entry_price);
      }
    }

    const { error } = await db.from("contracts").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const wasSettled = contract.status === "settled";
    const delta = nextPayout - (wasSettled ? previousPayout : 0);
    if (patch["status"] === "settled" || wasSettled) {
      await creditWallet(db, contract.user_id, contract.currency, delta);
    }

    await logAudit(db, context.userId, "contract.correction", contract.user_id, {
      contractId: data.id,
      patch,
      walletDelta: delta,
    });

    await db.from("notifications").insert({
      user_id: contract.user_id,
      title: "Trade adjusted",
      body: `Your ${contract.display_symbol} contract was updated by the trading desk.`,
      kind: "trade",
    });

    return { ok: true };
  });

/** Edit or force-close a leveraged position; realised P/L is settled to the wallet. */
export const correctPosition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        entryPrice: z.number().positive().optional(),
        exitPrice: z.number().positive().optional(),
        realizedPnl: z.number().optional(),
        close: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: position } = await db
      .from("positions")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!position) throw new Error("Position not found.");

    const patch: Record<string, unknown> = {};
    if (data.entryPrice !== undefined) patch["entry_price"] = data.entryPrice;
    if (data.exitPrice !== undefined) patch["exit_price"] = data.exitPrice;

    const previousPnl = Number(position.realized_pnl ?? 0);
    let nextPnl = previousPnl;

    if (data.close || data.realizedPnl !== undefined) {
      const entry = Number(data.entryPrice ?? position.entry_price);
      const exit = Number(data.exitPrice ?? position.exit_price ?? entry);
      const qty = Number(position.quantity);
      const direction = position.side === "long" ? 1 : -1;
      nextPnl =
        data.realizedPnl !== undefined ? data.realizedPnl : (exit - entry) * qty * direction;
      patch["realized_pnl"] = nextPnl;
      patch["exit_price"] = exit;
      patch["status"] = "closed";
      patch["closed_at"] = new Date().toISOString();
    }

    const { error } = await db.from("positions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);

    const wasClosed = position.status === "closed";
    const delta = nextPnl - (wasClosed ? previousPnl : 0);
    if (patch["status"] === "closed" || wasClosed) {
      await creditWallet(db, position.user_id, position.currency, delta);
    }

    await logAudit(db, context.userId, "position.correction", position.user_id, {
      positionId: data.id,
      patch,
      walletDelta: delta,
    });

    await db.from("notifications").insert({
      user_id: position.user_id,
      title: "Position adjusted",
      body: `Your ${position.display_symbol} position was updated by the trading desk.`,
      kind: "trade",
    });

    return { ok: true };
  });
