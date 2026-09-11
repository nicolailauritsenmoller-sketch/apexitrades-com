import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, assertAdmin, privileged, logAudit } from "@/lib/desk.server";

const ONLINE_WINDOW_MS = 5 * 60_000;

function shape(row: any, profile: any) {
  const online = Date.now() - new Date(row.last_active_at).getTime() < ONLINE_WINDOW_MS;
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: profile?.display_name ?? "Unknown user",
    email: profile?.email ?? null,
    uid: profile?.uid ?? null,
    deviceId: row.device_id as string,
    ip: row.ip_address as string | null,
    country: row.country as string | null,
    region: row.region as string | null,
    city: row.city as string | null,
    lat: row.latitude as number | null,
    lng: row.longitude as number | null,
    isp: row.isp as string | null,
    deviceType: (row.device_type as string | null) ?? "Desktop",
    deviceModel: (row.device_model as string | null) ?? `${row.os} device`,
    deviceVendor: row.device_vendor as string | null,
    os: row.os as string,
    osVersion: row.os_version as string | null,
    browser: row.browser as string,
    browserVersion: row.browser_version as string | null,
    screen: row.screen_resolution as string | null,
    path: row.current_path as string | null,
    lastActiveAt: row.last_active_at as string,
    online,
  };
}

/** All tracked sessions with geolocation, device model and online state. */
export const getTelemetryOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();

    const [{ data: sessions }, { data: activity }] = await Promise.all([
      db.from("user_sessions").select("*").order("last_active_at", { ascending: false }).limit(400),
      db
        .from("user_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    const rows = (sessions ?? []) as any[];
    const acts = (activity ?? []) as any[];
    const userIds = [...new Set([...rows, ...acts].map((r) => r.user_id))];
    const { data: profiles } = userIds.length
      ? await db.from("profiles").select("id,display_name,email,uid").in("id", userIds)
      : { data: [] as any[] };
    const byId = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));

    const shaped = rows.map((r) => shape(r, byId.get(r.user_id)));

    // High-risk signals: same account seen from far-apart locations recently,
    // or an unusually high device count.
    const alerts: { userId: string; name: string; kind: string; detail: string }[] = [];
    const grouped = new Map<string, ReturnType<typeof shape>[]>();
    for (const s of shaped) grouped.set(s.userId, [...(grouped.get(s.userId) ?? []), s]);
    for (const [userId, list] of grouped) {
      const countries = [...new Set(list.map((l) => l.country).filter(Boolean))];
      if (countries.length > 1) {
        alerts.push({
          userId,
          name: list[0]!.name,
          kind: "Location jump",
          detail: `Signed in from ${countries.join(", ")}`,
        });
      }
      if (list.length >= 4) {
        alerts.push({
          userId,
          name: list[0]!.name,
          kind: "Many devices",
          detail: `${list.length} active devices tracked`,
        });
      }
    }

    return {
      sessions: shaped,
      online: shaped.filter((s) => s.online).length,
      activity: acts.map((a) => ({
        id: a.id as string,
        userId: a.user_id as string,
        name: byId.get(a.user_id)?.display_name ?? "Unknown user",
        actionType: a.action_type as string,
        label: (a.label as string | null) ?? (a.action_type as string),
        route: a.route as string | null,
        city: a.city as string | null,
        country: a.country as string | null,
        ip: a.ip_address as string | null,
        createdAt: a.created_at as string,
      })),
      alerts,
    };
  });

/** Sessions, devices, activity stream and replay events for one user. */
export const getUserTelemetry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();

    const [{ data: profile }, { data: sessions }, { data: activity }] = await Promise.all([
      db.from("profiles").select("id,display_name,email,uid").eq("id", data.userId).maybeSingle(),
      db
        .from("user_sessions")
        .select("*")
        .eq("user_id", data.userId)
        .order("last_active_at", { ascending: false }),
      db
        .from("user_activity_logs")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    return {
      profile: (profile ?? null) as {
        id: string;
        display_name: string;
        email: string | null;
        uid: string | null;
      } | null,
      sessions: ((sessions ?? []) as any[]).map((r) => shape(r, profile)),
      activity: ((activity ?? []) as any[]).map((a) => ({
        id: a.id as string,
        actionType: a.action_type as string,
        label: (a.label as string | null) ?? (a.action_type as string),
        route: a.route as string | null,
        city: a.city as string | null,
        country: a.country as string | null,
        ip: a.ip_address as string | null,
        metadata: JSON.stringify(a.metadata_json ?? {}),
        domEvents: (a.dom_events_json ?? []) as {
          t: number;
          kind: string;
          target?: string;
          value?: string;
        }[],
        createdAt: a.created_at as string,
      })),
    };
  });

/** Force-disconnect a single tracked device. */
export const terminateSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: row } = await db
      .from("user_sessions")
      .select("user_id,device_id")
      .eq("id", data.id)
      .maybeSingle();
    await db.from("user_sessions").delete().eq("id", data.id);
    await logAudit(db, context.userId, "session.terminate", row?.user_id ?? null, {
      device_id: row?.device_id ?? null,
    });
    return { ok: true };
  });

/** Force-disconnect every tracked device for one user. */
export const terminateAllSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    await db.from("user_sessions").delete().eq("user_id", data.userId);
    await logAudit(db, context.userId, "session.terminate_all", data.userId, {});
    return { ok: true };
  });
