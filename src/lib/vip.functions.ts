import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, logAudit, privileged, appendSignature } from "@/lib/desk.server";
import { VIP_ROLE_KEYS } from "@/lib/vip";

const roleKey = z.enum(VIP_ROLE_KEYS);

const attachment = {
  attachmentPath: z.string().trim().max(400).nullable().optional(),
  attachmentName: z.string().trim().max(200).nullable().optional(),
  attachmentType: z.string().trim().max(120).nullable().optional(),
  attachmentSize: z.number().int().nonnegative().nullable().optional(),
};

function mapMessage(m: any) {
  return {
    id: m.id,
    body: m.body,
    senderRole: m.sender_role,
    createdAt: m.created_at,
    readAt: m.read_at,
    attachmentPath: m.attachment_path ?? null,
    attachmentName: m.attachment_name ?? null,
    attachmentType: m.attachment_type ?? null,
    attachmentSize: m.attachment_size ?? null,
  };
}

/* ------------------------------ user surface ----------------------------- */

/** Specialist directory with the caller's unlock state and unread counters. */
export const getVipDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await privileged();
    const [specialists, access, messages] = await Promise.all([
      db.from("vip_specialists").select("*").order("role_label"),
      db.from("vip_access").select("*").eq("user_id", context.userId),
      db
        .from("vip_messages")
        .select("role_key,sender_role,read_at,created_at")
        .eq("user_id", context.userId)
        .eq("is_internal", false),
    ]);

    const accessMap = new Map((access.data ?? []).map((a: any) => [a.role_key, a]));
    const msgs: any[] = messages.data ?? [];

    return (specialists.data ?? []).map((s: any) => {
      const grant = accessMap.get(s.role_key) as any;
      const mine = msgs.filter((m) => m.role_key === s.role_key);
      return {
        roleKey: s.role_key,
        roleLabel: s.role_label,
        fullName: s.full_name,
        title: s.title,
        staffId: s.staff_id,
        avatarUrl: s.avatar_url,
        unlocked: !!grant?.unlocked,
        requested: !!grant,
        unread: mine.filter((m) => m.sender_role !== "user" && !m.read_at).length,
        lastMessageAt:
          mine.map((m) => m.created_at).sort((a, b) => (a < b ? 1 : -1))[0] ?? null,
      };
    });
  });

/** Thread history for one specialist; marks specialist messages as read. */
export const getVipThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roleKey }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: rows } = await db
      .from("vip_messages")
      .select("*")
      .eq("user_id", context.userId)
      .eq("role_key", data.roleKey)
      .eq("is_internal", false)
      .order("created_at")
      .limit(300);

    await db
      .from("vip_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("role_key", data.roleKey)
      .neq("sender_role", "user")
      .eq("is_internal", false)
      .is("read_at", null);

    return (rows ?? []).map(mapMessage);
  });

/** Asks support to unlock a locked specialist thread. */
export const requestVipAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ roleKey }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: existing } = await db
      .from("vip_access")
      .select("id,unlocked")
      .eq("user_id", context.userId)
      .eq("role_key", data.roleKey)
      .maybeSingle();
    if (existing?.unlocked) return { ok: true, unlocked: true };
    if (!existing) {
      await db
        .from("vip_access")
        .insert({ user_id: context.userId, role_key: data.roleKey, unlocked: false });
    }
    return { ok: true, unlocked: false };
  });

/** Sends a user message into an unlocked specialist thread. */
export const sendVipMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ roleKey, body: z.string().trim().max(2000).default(""), ...attachment })
      .refine((v) => v.body.length > 0 || !!v.attachmentPath, {
        message: "Message or attachment required.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: grant } = await db
      .from("vip_access")
      .select("unlocked")
      .eq("user_id", context.userId)
      .eq("role_key", data.roleKey)
      .maybeSingle();
    if (!grant?.unlocked) throw new Error("This specialist thread is locked.");

    const { error } = await db.from("vip_messages").insert({
      user_id: context.userId,
      role_key: data.roleKey,
      sender_role: "user",
      sender_id: context.userId,
      body: data.body || (data.attachmentName ?? "Attachment"),
      attachment_path: data.attachmentPath ?? null,
      attachment_name: data.attachmentName ?? null,
      attachment_type: data.attachmentType ?? null,
      attachment_size: data.attachmentSize ?? null,
    });
    if (error) throw new Error(error.message);
    // A new trader message reopens a resolved thread.
    await db.from("vip_access").update({ thread_status: "open", resolved_at: null }).eq("user_id", context.userId).eq("role_key", data.roleKey).eq("thread_status", "resolved");
    return { ok: true };
  });

/* ------------------------------ staff surface ---------------------------- */

export const getVipDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const [specialists, access, messages, profiles] = await Promise.all([
      db.from("vip_specialists").select("*").order("role_label"),
      db.from("vip_access").select("*").order("updated_at", { ascending: false }),
      db.from("vip_messages").select("*").order("created_at", { ascending: false }).limit(1500),
      db.from("profiles").select("id,display_name,uid").limit(1000),
    ]);

    const pmap = new Map((profiles.data ?? []).map((p: any) => [p.id, p]));
    const msgs: any[] = messages.data ?? [];

    const threads = (access.data ?? []).map((a: any) => {
      const thread = msgs.filter((m) => m.user_id === a.user_id && m.role_key === a.role_key);
      const visible = thread.filter((m) => !m.is_internal);
      const last = visible[0];
      // SLA clock starts at the oldest trader message after the last specialist reply.
      let waitingSince: string | null = null;
      for (const m of visible) { if (m.sender_role === "user") waitingSince = m.created_at; else break; }
      return {
        status: a.thread_status ?? "open",
        assignedTo: a.assigned_to ?? null,
        assignedName: a.assigned_to ? ((pmap.get(a.assigned_to) as any)?.display_name ?? "Staff") : null,
        waitingSince,
        userId: a.user_id,
        roleKey: a.role_key,
        unlocked: a.unlocked,
        userName: (pmap.get(a.user_id) as any)?.display_name ?? "Trader",
        userUid: (pmap.get(a.user_id) as any)?.uid ?? a.user_id.slice(0, 8),
        unread: thread.filter((m) => m.sender_role === "user" && !m.read_at).length,
        lastBody: last?.body ?? null,
        lastAt: last?.created_at ?? a.updated_at,
      };
    });

    return {
      specialists: (specialists.data ?? []).map((s: any) => ({
        roleKey: s.role_key,
        roleLabel: s.role_label,
        fullName: s.full_name,
        title: s.title,
        staffId: s.staff_id,
        avatarUrl: s.avatar_url,
        active: s.active,
        availability: s.availability ?? "available",
      })),
      threads: threads.sort((a: any, b: any) => (a.lastAt < b.lastAt ? 1 : -1)),
    };
  });

export const getVipDeskThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ userId: z.string().uuid(), roleKey }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("vip_messages")
      .select("*")
      .eq("user_id", data.userId)
      .eq("role_key", data.roleKey)
      .order("created_at")
      .limit(300);
    await db
      .from("vip_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", data.userId)
      .eq("role_key", data.roleKey)
      .eq("sender_role", "user")
      .is("read_at", null);
    const { data: audit } = await db
      .from("admin_audit_logs")
      .select("id,action,actor_name,details,created_at")
      .eq("target_user_id", data.userId)
      .like("action", "vip.%")
      .order("created_at", { ascending: false })
      .limit(40);
    return {
      messages: (rows ?? []).map((m: any) => ({ ...mapMessage(m), internal: !!m.is_internal })),
      audit: (audit ?? []).filter((a: any) => !a.details?.roleKey || a.details.roleKey === data.roleKey || a.details.to === data.roleKey || a.details.from === data.roleKey),
    };
  });

export const sendVipDeskMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        roleKey,
        body: z.string().trim().max(2000).default(""),
        internal: z.boolean().optional(),
        ...attachment,
      })
      .refine((v) => v.body.length > 0 || !!v.attachmentPath, {
        message: "Message or attachment required.",
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("vip_messages").insert({
      user_id: data.userId,
      role_key: data.roleKey,
      sender_role: "specialist",
      sender_id: context.userId,
      body: data.internal || !data.body ? data.body || (data.attachmentName ?? "Attachment") : await appendSignature(db, context.userId, data.body),
      attachment_path: data.attachmentPath ?? null,
      attachment_name: data.attachmentName ?? null,
      attachment_type: data.attachmentType ?? null,
      attachment_size: data.attachmentSize ?? null,
      is_internal: !!data.internal,
    });
    if (error) throw new Error(error.message);
    if (data.internal) {
      await logAudit(db, context.userId, "vip.thread.note", data.userId, { roleKey: data.roleKey });
      return { ok: true };
    }
    // First reply auto-assigns the thread to the replying staff member.
    const { data: acc } = await db.from("vip_access").select("assigned_to,thread_status").eq("user_id", data.userId).eq("role_key", data.roleKey).maybeSingle();
    if (acc && (!acc.assigned_to || acc.thread_status === "resolved")) {
      await db.from("vip_access").update({ assigned_to: acc.assigned_to ?? context.userId, thread_status: "open", resolved_at: null }).eq("user_id", data.userId).eq("role_key", data.roleKey);
      if (!acc.assigned_to) await logAudit(db, context.userId, "vip.thread.assign", data.userId, { roleKey: data.roleKey, auto: true });
    }

    const { data: specialist } = await db
      .from("vip_specialists")
      .select("full_name,role_label")
      .eq("role_key", data.roleKey)
      .maybeSingle();
    await db.from("notifications").insert({
      user_id: data.userId,
      title: `${specialist?.full_name ?? "Your specialist"} replied`,
      body: `New message in your ${specialist?.role_label ?? "VIP"} conversation.`,
      kind: "support",
    });
    return { ok: true };
  });

export const saveVipSpecialist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        roleKey,
        fullName: z.string().trim().min(2).max(80),
        title: z.string().trim().min(2).max(80),
        staffId: z.string().trim().min(2).max(40),
        avatarUrl: z.string().trim().url().max(500).nullable().optional(),
        active: z.boolean().optional(),
        availability: z.enum(["available", "busy", "offline"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db
      .from("vip_specialists")
      .update({
        full_name: data.fullName,
        title: data.title,
        staff_id: data.staffId,
        avatar_url: data.avatarUrl ?? null,
        ...(data.active === undefined ? {} : { active: data.active }),
      })
      .eq("role_key", data.roleKey);
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "vip.specialist.update", null, { roleKey: data.roleKey });
    return { ok: true };
  });

/** Unlocks or locks one specialist thread for a user (by account UID or user id). */
export const setVipAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userRef: z.string().trim().min(3).max(60),
        roleKey,
        unlocked: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data.userRef,
    );
    const { data: profile } = isUuid
      ? await db.from("profiles").select("id").eq("id", data.userRef).maybeSingle()
      : await db
          .from("profiles")
          .select("id")
          .eq("uid", data.userRef.replace(/^#/, "").toUpperCase())
          .maybeSingle();
    if (!profile) throw new Error("No account matches that UID.");

    const { error } = await db.from("vip_access").upsert(
      {
        user_id: profile.id,
        role_key: data.roleKey,
        unlocked: data.unlocked,
        granted_by: context.userId,
      },
      { onConflict: "user_id,role_key" },
    );
    if (error) throw new Error(error.message);

    const { data: specialist } = await db
      .from("vip_specialists")
      .select("role_label")
      .eq("role_key", data.roleKey)
      .maybeSingle();

    if (data.unlocked) {
      await db.from("notifications").insert({
        user_id: profile.id,
        title: "VIP specialist unlocked",
        body: `Your ${specialist?.role_label ?? "VIP"} chat is now available in Profile → Support.`,
        kind: "support",
      });
    }

    await logAudit(db, context.userId, "vip.access.set", profile.id, {
      roleKey: data.roleKey,
      unlocked: data.unlocked,
    });
    return { ok: true };
  });

/** Signed URL for a VIP chat attachment - staff for any thread, users for their own. */
export const getVipAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ messageId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const { data: message } = await db
      .from("vip_messages")
      .select("id,user_id,attachment_path")
      .eq("id", data.messageId)
      .maybeSingle();
    if (!message?.attachment_path) return { url: null };

    if (message.user_id !== context.userId) {
      await assertStaff(context);
    }

    const { data: signed } = await db.storage
      .from("chat-attachments")
      .createSignedUrl(message.attachment_path, 900);
    return { url: signed?.signedUrl ?? null };
  });

/** Online status for a specialist persona (Available / In call / Offline). */
export const setSpecialistAvailability = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ roleKey, availability: z.enum(["available", "busy", "offline"]) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { error } = await db.from("vip_specialists").update({ availability: data.availability }).eq("role_key", data.roleKey);
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "vip.specialist.availability", null, data);
    return { ok: true };
  });

/** Uploads a specialist avatar to the public avatar bucket and returns its URL. */
export const uploadSpecialistAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      roleKey,
      contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
      base64: z.string().max(3_000_000),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 2_000_000) throw new Error("Image must be 2 MB or smaller.");
    await db.storage.createBucket("specialist-avatars", { public: true }).catch(() => undefined);
    const ext = data.contentType.split("/")[1];
    const path = `${data.roleKey}/${Date.now()}.${ext}`;
    const { error } = await db.storage.from("specialist-avatars").upload(path, bytes, { contentType: data.contentType, upsert: true });
    if (error) throw new Error(error.message);
    const url = db.storage.from("specialist-avatars").getPublicUrl(path).data.publicUrl;
    await db.from("vip_specialists").update({ avatar_url: url }).eq("role_key", data.roleKey);
    await logAudit(db, context.userId, "vip.specialist.avatar", null, { roleKey: data.roleKey });
    return { url };
  });

/** Thread workflow: assign to me, resolve, reopen, or transfer to another specialist role. */
export const updateVipThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid(),
      roleKey,
      action: z.enum(["assign", "unassign", "resolve", "reopen", "transfer"]),
      toRole: roleKey.optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const match = (q: any) => q.eq("user_id", data.userId).eq("role_key", data.roleKey);
    const now = new Date().toISOString();
    if (data.action === "transfer") {
      if (!data.toRole || data.toRole === data.roleKey) throw new Error("Choose a different specialist role.");
      const { data: existing } = await db.from("vip_access").select("id").eq("user_id", data.userId).eq("role_key", data.toRole).maybeSingle();
      if (existing) throw new Error("This trader already has a thread with that specialist.");
      const { error } = await match(db.from("vip_access").update({ role_key: data.toRole, assigned_to: null, thread_status: "open", resolved_at: null, unlocked: true }));
      if (error) throw new Error(error.message);
      await match(db.from("vip_messages").update({ role_key: data.toRole }));
      const { data: sp } = await db.from("vip_specialists").select("role_label,full_name").eq("role_key", data.toRole).maybeSingle();
      await db.from("vip_messages").insert({
        user_id: data.userId, role_key: data.toRole, sender_role: "specialist", sender_id: context.userId,
        body: `Your conversation has been transferred to ${sp?.full_name ?? "a specialist"} (${sp?.role_label ?? "VIP"}).`,
      });
      await logAudit(db, context.userId, "vip.thread.transfer", data.userId, { from: data.roleKey, to: data.toRole });
      return { ok: true, roleKey: data.toRole };
    }
    const patch =
      data.action === "assign" ? { assigned_to: context.userId, thread_status: "open" }
      : data.action === "unassign" ? { assigned_to: null }
      : data.action === "resolve" ? { thread_status: "resolved", resolved_at: now }
      : { thread_status: "open", resolved_at: null };
    const { error } = await match(db.from("vip_access").update(patch));
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, `vip.thread.${data.action}`, data.userId, { roleKey: data.roleKey });
    return { ok: true, roleKey: data.roleKey };
  });
