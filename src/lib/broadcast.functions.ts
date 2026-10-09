import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, logAudit, privileged } from "@/lib/desk.server";

const audience = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("kyc"), level: z.enum(["unverified", "tier1", "tier2"]) }),
  z.object({ kind: z.literal("vip"), minLevel: z.number().int().min(1).max(10).default(1), minPortfolio: z.number().nonnegative().default(0) }),
  z.object({ kind: z.literal("list"), refs: z.array(z.string().trim().min(3).max(200)).min(1).max(5000) }),
  z.object({ kind: z.literal("open_positions") }),
]);
type Audience = z.infer<typeof audience>;

function label(a: Audience) {
  switch (a.kind) {
    case "all": return "All active traders";
    case "kyc": return { unverified: "KYC: Unverified", tier1: "KYC: Tier 1 Verified", tier2: "KYC: Tier 2" }[a.level];
    case "vip": return `VIP Tier ${a.minLevel}+${a.minPortfolio ? `, portfolio >= ${a.minPortfolio.toLocaleString()} USDT` : ""}`;
    case "list": return `Custom list (${a.refs.length})`;
    case "open_positions": return "Users with open positions";
  }
}

async function resolve(db: any, a: Audience): Promise<{ ids: string[]; unmatched: number }> {
  const { data: all } = await db.from("profiles").select("id,uid,email,account_frozen,suspension_status").limit(20000);
  const active = (all ?? []).filter((p: any) => !p.account_frozen && p.suspension_status === "active");
  const ids = new Set<string>(active.map((p: any) => p.id));
  const keep = (set: Set<string>) => [...ids].filter((i) => set.has(i));
  if (a.kind === "all") return { ids: [...ids], unmatched: 0 };
  if (a.kind === "kyc") {
    const { data: k } = await db.from("kyc_submissions").select("user_id,status,level2_status");
    const t1 = new Set<string>(), t2 = new Set<string>();
    for (const r of k ?? []) { if (r.status === "approved") t1.add(r.user_id); if (r.level2_status === "approved") t2.add(r.user_id); }
    if (a.level === "tier2") return { ids: keep(t2), unmatched: 0 };
    if (a.level === "tier1") return { ids: keep(new Set([...t1].filter((x) => !t2.has(x)))), unmatched: 0 };
    return { ids: [...ids].filter((i) => !t1.has(i)), unmatched: 0 };
  }
  if (a.kind === "vip") {
    const { data: v } = await db.from("vip_accounts").select("user_id,level,portfolio_usdt").gte("level", a.minLevel);
    return { ids: keep(new Set((v ?? []).filter((r: any) => Number(r.portfolio_usdt) >= a.minPortfolio).map((r: any) => r.user_id))), unmatched: 0 };
  }
  if (a.kind === "open_positions") {
    const [{ data: p }, { data: c }] = await Promise.all([
      db.from("positions").select("user_id").eq("status", "open"),
      db.from("contracts").select("user_id").eq("status", "open"),
    ]);
    return { ids: keep(new Set([...(p ?? []), ...(c ?? [])].map((r: any) => r.user_id))), unmatched: 0 };
  }
  // Custom list: UIDs (with or without #) or emails. Explicit lists may include frozen accounts.
  const byUid = new Map((all ?? []).map((p: any) => [String(p.uid ?? "").toUpperCase(), p.id]));
  const byEmail = new Map((all ?? []).filter((p: any) => p.email).map((p: any) => [String(p.email).toLowerCase(), p.id]));
  const out = new Set<string>(); let unmatched = 0;
  for (const raw of a.refs) {
    const r = raw.replace(/^#/, "");
    const id = r.includes("@") ? byEmail.get(r.toLowerCase()) : byUid.get(r.toUpperCase());
    if (id) out.add(id as string); else unmatched++;
  }
  return { ids: [...out], unmatched };
}

async function actor(db: any, userId: string) {
  const [{ data: p }, { data: a }] = await Promise.all([
    db.from("profiles").select("display_name,uid").eq("id", userId).maybeSingle(),
    db.from("agent_profiles").select("staff_id,full_name").eq("user_id", userId).maybeSingle(),
  ]);
  return { name: a?.full_name ?? p?.display_name ?? "Staff", staffId: a?.staff_id ?? p?.uid ?? userId.slice(0, 8) };
}

/** Preview the recipient count for an audience without sending. */
export const previewBroadcastAudience = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ audience }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const r = await resolve(await privileged(), data.audience);
    return { count: r.ids.length, unmatched: r.unmatched };
  });

export const sendBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().min(2).max(1000),
      templateKey: z.string().max(60).nullable().optional(),
      severity: z.enum(["info", "warning", "critical"]).default("info"),
      audience,
      channels: z.array(z.enum(["banner", "inbox", "push", "email"])).min(1),
      test: z.boolean().default(false),
      emergency: z.boolean().default(false),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const me = await actor(db, context.userId);
    // Test dispatches go only to the operator's own account.
    const { ids, unmatched } = data.test ? { ids: [context.userId], unmatched: 0 } : await resolve(db, data.audience);
    if (ids.length === 0) throw new Error("No accounts match this audience.");

    const title = data.test ? `[TEST] ${data.title}` : data.title;
    const { data: log, error: logErr } = await db.from("broadcast_logs").insert({
      title, body: data.body, template_key: data.templateKey ?? null, audience: data.audience,
      audience_label: data.test ? "Test - operator only" : label(data.audience),
      channels: data.channels, recipients: ids.length, status: "sending",
      is_test: data.test, emergency: data.emergency, actor_id: context.userId, actor_name: me.name, actor_staff_id: me.staffId,
    }).select("id").single();
    if (logErr) throw new Error(logErr.message);

    let delivered = 0, failed = unmatched;
    const skipped: string[] = [];
    const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

    if (data.channels.includes("inbox")) {
      for (const part of chunk(ids, 500)) {
        const { error } = await db.from("notifications").insert(part.map((u) => ({ user_id: u, title, body: data.body, kind: "announcement", broadcast_id: log.id })));
        if (error) failed += part.length; else delivered += part.length;
      }
    }
    if (data.channels.includes("banner")) {
      const global = !data.test && data.audience.kind === "all";
      const rows = global ? [{ target_user_id: null }] : ids.map((u) => ({ target_user_id: u }));
      let ok = 0;
      for (const part of chunk(rows, 500)) {
        const { error } = await db.from("announcements").insert(part.map((r) => ({ ...r, title, body: data.body, severity: data.severity, active: true, created_by: context.userId })));
        if (error) failed += global ? ids.length : part.length; else ok += global ? ids.length : part.length;
      }
      if (!data.channels.includes("inbox")) delivered += ok;
    }
    // Push and email have no delivery provider configured yet; they are logged as skipped, never as sent.
    if (data.channels.includes("push")) skipped.push("push");
    if (data.channels.includes("email")) skipped.push("email");

    const status = failed && !delivered ? "failed" : failed || skipped.length ? "partial" : "sent";
    await db.from("broadcast_logs").update({ delivered, failed, skipped_channels: skipped, status }).eq("id", log.id);
    await logAudit(db, context.userId, data.test ? "broadcast.test" : data.emergency ? "broadcast.emergency" : "broadcast.create", null, {
      broadcast_id: log.id, title, audience: label(data.audience), channels: data.channels, recipients: ids.length, delivered, failed, skipped,
    });
    return { delivered, failed, skipped, recipients: ids.length };
  });

export const getBroadcastDesk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: logs } = await db.from("broadcast_logs").select("*").order("created_at", { ascending: false }).limit(200);
    const ids = (logs ?? []).map((l: any) => l.id);
    const reads = new Map<string, { n: number; read: number }>();
    if (ids.length) {
      const { data: n } = await db.from("notifications").select("broadcast_id,read_at").in("broadcast_id", ids).limit(50000);
      for (const r of n ?? []) {
        const e = reads.get(r.broadcast_id!) ?? { n: 0, read: 0 };
        e.n++; if (r.read_at) e.read++;
        reads.set(r.broadcast_id!, e);
      }
    }
    const rows = (logs ?? []).map((l: any) => ({ ...l, inboxCount: reads.get(l.id)?.n ?? 0, readCount: reads.get(l.id)?.read ?? 0 }));
    const real = rows.filter((r) => !r.is_test);
    const inbox = real.reduce((s, r) => s + r.inboxCount, 0);
    return {
      rows,
      totals: {
        sent: real.reduce((s, r) => s + r.delivered, 0),
        readRate: inbox ? (real.reduce((s, r) => s + r.readCount, 0) / inbox) * 100 : null,
        failures: real.reduce((s, r) => s + r.failed, 0),
      },
    };
  });
