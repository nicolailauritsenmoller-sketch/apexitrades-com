import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit, privileged } from "@/lib/desk.server";

const channelInput = z.object({
  id: z.string().uuid(),
  inviteUrl: z.string().trim().url().max(500).nullable(),
  memberCount: z.number().int().min(0).max(100_000_000),
  status: z.enum(["active", "maintenance"]),
});

const announcementInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(4000),
  category: z.enum(["signal", "event", "security", "maintenance"]),
  status: z.enum(["published", "draft"]),
});

export const getCommunityDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const [channels, announcements, requests] = await Promise.all([
      db.from("community_channels").select("*").order("sort_order"),
      db.from("community_announcements").select("*").order("created_at", { ascending: false }),
      db.from("community_vip_requests").select("*").order("created_at", { ascending: false }),
    ]);
    const requestRows = requests.data ?? [];
    const userIds = [...new Set(requestRows.map((row: any) => row.user_id))];
    const profiles = userIds.length
      ? (await db.from("profiles").select("id,uid,display_name,email,vip_tier").in("id", userIds)).data ?? []
      : [];
    const profileMap = new Map(profiles.map((profile: any) => [profile.id, profile]));
    return {
      channels: channels.data ?? [],
      announcements: announcements.data ?? [],
      requests: requestRows.map((row: any) => ({ ...row, profile: profileMap.get(row.user_id) ?? null })),
    };
  });

export const updateCommunityChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => channelInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("community_channels").update({
      invite_url: data.inviteUrl,
      member_count: data.memberCount,
      status: data.status,
      updated_by: context.userId,
    }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "community.channel.update", null, { channel_id: data.id, status: data.status });
    return { ok: true };
  });

export const upsertCommunityAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => announcementInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const payload = { title: data.title, body: data.body, category: data.category, status: data.status, created_by: context.userId };
    const query = data.id
      ? db.from("community_announcements").update(payload).eq("id", data.id)
      : db.from("community_announcements").insert(payload);
    const { error } = await query;
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, data.id ? "community.announcement.update" : "community.announcement.create", null, { title: data.title, status: data.status });
    return { ok: true };
  });

export const requestCommunityVipAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ note: z.string().trim().max(500).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase.from("profiles").select("vip_tier").eq("id", context.userId).maybeSingle();
    if (profile?.vip_tier !== "vip1") throw new Error("Verified VIP membership is required.");
    const { error } = await context.supabase.from("community_vip_requests").upsert({
      user_id: context.userId,
      request_note: data.note ?? null,
      status: "pending",
      review_note: null,
      reviewed_by: null,
      reviewed_at: null,
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewCommunityVipRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]), note: z.string().trim().max(500).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: request } = await db.from("community_vip_requests").select("user_id").eq("id", data.id).maybeSingle();
    if (!request) throw new Error("Access request not found.");
    const status = data.action === "approve" ? "approved" : "rejected";
    const { error } = await db.from("community_vip_requests").update({ status, review_note: data.note ?? null, reviewed_by: context.userId, reviewed_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await db.from("notifications").insert({
      user_id: request.user_id,
      title: data.action === "approve" ? "VIP Lounge access approved" : "VIP Lounge request declined",
      body: data.action === "approve" ? "Your private community access request has been approved." : `Your private community access request was declined.${data.note ? ` ${data.note}` : ""}`,
      kind: data.action === "approve" ? "success" : "warning",
    });
    await logAudit(db, context.userId, `community.vip.${data.action}`, request.user_id, { request_id: data.id, note: data.note ?? null });
    return { ok: true };
  });