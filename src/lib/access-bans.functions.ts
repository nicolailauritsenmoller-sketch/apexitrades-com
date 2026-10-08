import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";

function callerIp(): string | null {
  try {
    const h = getRequestHeaders() as unknown as Record<string, string | undefined>;
    const fwd = h["x-forwarded-for"];
    return h["cf-connecting-ip"] ?? h["x-real-ip"] ?? (fwd ? fwd.split(",")[0]!.trim() : null) ?? null;
  } catch {
    return null;
  }
}

/** Checks the caller's real network IP (from request headers) and device ID against active bans. */
export const checkAccessBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().trim().max(200) }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await privileged();
    const ip = callerIp();
    const values = [data.deviceId, ip].filter(Boolean) as string[];
    const { data: rows } = await db
      .from("access_bans")
      .select("kind,value")
      .eq("active", true)
      .in("value", values);
    const hit = (rows ?? []).find(
      (r: any) => (r.kind === "device" && r.value === data.deviceId) || (r.kind === "ip" && r.value === ip),
    );
    if (!hit) return { banned: false as const };
    await db.from("security_logs").insert({
      user_id: context.userId,
      event: "access_ban_blocked",
      detail: `${hit.kind} ban matched`,
      ip_address: ip,
    } as any);
    await db.from("user_sessions").update({ is_online: false } as any).eq("user_id", context.userId).eq("device_id", data.deviceId);
    return { banned: true as const, kind: hit.kind as "ip" | "device" };
  });

async function audit(ctx: { userId: string }, action: string, details: Record<string, unknown>, target: string | null = null) {
  const db = await privileged();
  const { data: me } = await db.from("profiles").select("display_name").eq("id", ctx.userId).maybeSingle();
  await db.from("admin_audit_logs").insert({
    actor_id: ctx.userId,
    actor_name: me?.display_name ?? null,
    action,
    target_user_id: target,
    details,
  } as any);
}

export const listAccessBans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const [bans, sessions] = await Promise.all([
      db.from("access_bans").select("*").order("created_at", { ascending: false }).limit(200),
      db
        .from("user_sessions")
        .select("user_id,device_id,ip_address,browser,os,country,city,last_active_at")
        .order("last_active_at", { ascending: false })
        .limit(60),
    ]);
    const ids = [...new Set((sessions.data ?? []).map((s: any) => s.user_id))];
    const { data: profiles } = ids.length
      ? await db.from("profiles").select("id,display_name,uid").in("id", ids)
      : { data: [] as any[] };
    const pmap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
    return {
      bans: bans.data ?? [],
      sessions: (sessions.data ?? []).map((s: any) => ({ ...s, profile: pmap.get(s.user_id) ?? null })),
    };
  });

export const createAccessBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum(["ip", "device"]),
        value: z.string().trim().min(3).max(200),
        reason: z.string().trim().min(5).max(300),
        userId: z.string().uuid().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { error } = await db.from("access_bans").insert({
      kind: data.kind,
      value: data.value,
      reason: data.reason,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message.includes("duplicate") ? "This is already banned." : error.message);
    if (data.kind === "device") {
      await db.from("user_sessions").update({ is_online: false } as any).eq("device_id", data.value);
    }
    await audit(context, `access.ban_${data.kind}`, { value: data.value, reason: data.reason }, data.userId ?? null);
    return { ok: true };
  });

export const liftAccessBan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: row } = await db
      .from("access_bans")
      .update({ active: false, lifted_by: context.userId, lifted_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("kind,value")
      .maybeSingle();
    await audit(context, "access.ban_lifted", { id: data.id, kind: row?.kind, value: row?.value });
    return { ok: true };
  });
