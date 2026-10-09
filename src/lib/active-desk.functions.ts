import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, assertStaff, logAudit, privileged } from "./desk.server";

/** Live sessions (last 15 min) with geo, device, role, heartbeat age, flags and today's peak. */
export const getActiveDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    const db = await privileged();
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const [{ data: sess }, { data: today }] = await Promise.all([
      db.from("user_sessions").select("*").gte("last_active_at", since).order("last_active_at", { ascending: false }).limit(500),
      db.from("user_sessions").select("user_id,created_at,last_active_at").gte("last_active_at", dayStart.toISOString()).limit(5000),
    ]);
    const list = (sess ?? []) as any[];
    const ids = [...new Set(list.map((s) => s.user_id))];
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      ids.length ? db.from("profiles").select("id,display_name,uid,email,account_frozen").in("id", ids) : { data: [] },
      ids.length ? db.from("user_roles").select("user_id,role").in("user_id", ids) : { data: [] },
    ]);
    const P = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p]));
    const R = new Map<string, string[]>();
    for (const r of (roles ?? []) as any[]) R.set(r.user_id, [...(R.get(r.user_id) ?? []), r.role]);
    const perUser = new Map<string, { devices: Set<string>; ips: Set<string> }>();
    for (const s of list) {
      const e = perUser.get(s.user_id) ?? { devices: new Set(), ips: new Set() };
      e.devices.add(s.device_id); if (s.ip_address) e.ips.add(s.ip_address);
      perUser.set(s.user_id, e);
    }

    // Peak concurrency today: distinct users whose session spans each 5-minute bucket.
    const buckets = new Map<number, Set<string>>();
    for (const s of (today ?? []) as any[]) {
      const a = Math.max(new Date(s.created_at).getTime(), dayStart.getTime());
      const b = new Date(s.last_active_at).getTime();
      for (let t = Math.floor(a / 300_000); t <= Math.floor(b / 300_000) && t - Math.floor(a / 300_000) < 300; t++) {
        const set = buckets.get(t) ?? new Set(); set.add(s.user_id); buckets.set(t, set);
      }
    }
    let peak = 0; for (const s of buckets.values()) peak = Math.max(peak, s.size);

    const rows = list.map((s) => {
      const p = P.get(s.user_id) ?? {};
      const r = R.get(s.user_id) ?? [];
      const u = perUser.get(s.user_id)!;
      const dt = String(s.device_type ?? "").toLowerCase();
      return {
        id: s.id, userId: s.user_id, name: p.display_name ?? "Trader", uid: p.uid ?? null, email: p.email ?? null,
        frozen: !!p.account_frozen,
        role: r.includes("admin") ? "admin" : r.includes("agent") || r.includes("finance") ? "staff" : "trader",
        device: dt.includes("tablet") ? "Tablet" : dt.includes("mobile") || /iOS|Android/i.test(s.os ?? "") ? "Mobile" : "Desktop",
        browser: s.browser, os: s.os, ip: s.ip_address, city: s.city, region: s.region, country: s.country, isp: s.isp,
        path: s.current_path, lastActiveAt: s.last_active_at, loginAt: s.created_at,
        flagged: u.devices.size > 1 || u.ips.size > 1,
      };
    });
    peak = Math.max(peak, ids.length);
    return { rows, peak, flagged: [...perUser.values()].filter((u) => u.devices.size > 1 || u.ips.size > 1).length };
  });

async function revokeAll(userId: string) {
  try {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
    const res = await fetch(`${url}/auth/v1/admin/users/${userId}/logout`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}` } });
    return res.ok;
  } catch { return false; }
}

const input = z.object({ userId: z.string().uuid(), sessionId: z.string().uuid().optional(), reason: z.string().trim().min(5).max(400) });

/** Force logout: revokes the account's sign-in tokens and removes the session record. */
export const forceLogoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot terminate your own session here.");
    const db = await privileged();
    const revoked = await revokeAll(data.userId);
    await db.from("user_sessions").delete().eq("user_id", data.userId);
    await logAudit(db, context.userId, "session.force_logout", data.userId, { session_id: data.sessionId ?? null, revoked, reason: data.reason });
    return { ok: true, revoked };
  });

/** Instant lockout: freezes the account and kicks every live session. */
export const instantLockout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => input.parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("You cannot lock out your own account.");
    const db = await privileged();
    const { error } = await db.from("profiles").update({ account_frozen: true, trading_frozen: true, withdrawals_disabled: true }).eq("id", data.userId);
    if (error) throw new Error(error.message);
    const revoked = await revokeAll(data.userId);
    await db.from("user_sessions").delete().eq("user_id", data.userId);
    await db.from("notifications").insert({ user_id: data.userId, title: "Account access restricted", body: "Your account was locked for a security review. Contact support for assistance.", kind: "warning" });
    await logAudit(db, context.userId, "session.instant_lockout", data.userId, { revoked, reason: data.reason });
    return { ok: true };
  });
