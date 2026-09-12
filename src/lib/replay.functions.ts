import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStaff, privileged } from "@/lib/desk.server";

/** Recorded screen sessions for one user, newest first. */
export const listUserReplays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("session_replays")
      .select("session_key,route,device_id,started_at,created_at,event_count,chunk_index")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(600);

    const map = new Map<
      string,
      {
        sessionKey: string;
        route: string | null;
        deviceId: string | null;
        startedAt: string;
        lastAt: string;
        events: number;
        chunks: number;
      }
    >();
    for (const r of (rows ?? []) as any[]) {
      const key = r.session_key as string;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          sessionKey: key,
          route: r.route ?? null,
          deviceId: r.device_id ?? null,
          startedAt: r.started_at,
          lastAt: r.created_at,
          events: r.event_count ?? 0,
          chunks: 1,
        });
      } else {
        prev.events += r.event_count ?? 0;
        prev.chunks += 1;
        if (r.created_at > prev.lastAt) prev.lastAt = r.created_at;
        if (r.started_at < prev.startedAt) prev.startedAt = r.started_at;
      }
    }
    return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  });

/** Full ordered rrweb event stream for one recorded session. */
export const getReplayEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), sessionKey: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertStaff(context);
    const db = await privileged();
    const { data: rows } = await db
      .from("session_replays")
      .select("events,chunk_index")
      .eq("user_id", data.userId)
      .eq("session_key", data.sessionKey)
      .order("chunk_index", { ascending: true });

    const events: any[] = [];
    for (const r of (rows ?? []) as any[]) {
      if (Array.isArray(r.events)) events.push(...r.events);
    }
    return { events };
  });
