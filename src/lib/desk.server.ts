/** Server-only helpers for the operations desk server functions. */

type Ctx = { supabase: any; userId: string };

export async function myRoles(context: Ctx): Promise<string[]> {
  // Read through the caller's own client first (RLS: users can read their own
  // roles). If that returns nothing - e.g. the row is only visible to the
  // service role - fall back to a service-role lookup scoped strictly to the
  // authenticated user id, never to a client-supplied value.
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);

  if (!error && data && data.length > 0) {
    return data.map((r: { role: string }) => r.role);
  }

  const db = await privileged();
  const { data: fallback } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);
  return (fallback ?? []).map((r: { role: string }) => r.role);
}

export async function assertStaff(context: Ctx) {
  const roles = await myRoles(context);
  if (!roles.includes("admin") && !roles.includes("agent")) {
    throw new Error("Forbidden: staff access required.");
  }
}

export async function assertAdmin(context: Ctx) {
  const roles = await myRoles(context);
  if (!roles.includes("admin")) throw new Error("Forbidden: Control Center access required.");
}

/** Service-role client - the only way privileged tables can be written. */
export async function privileged() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = await requestIp();
  const base = supabaseAdmin as any;
  // Stamp the operator's request IP onto every audit entry written through this client.
  return new Proxy(base, {
    get(target, prop) {
      if (prop !== "from") return Reflect.get(target, prop);
      return (table: string) => {
        const q = target.from(table);
        if (table !== "admin_audit_logs") return q;
        const insert = q.insert.bind(q);
        q.insert = (rows: any, ...rest: any[]) => {
          const stamp = (r: any) => ({ ...r, details: { ip, ...(r?.details ?? {}) } });
          return insert(Array.isArray(rows) ? rows.map(stamp) : stamp(rows), ...rest);
        };
        return q;
      };
    },
  });
}

async function requestIp(): Promise<string | null> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const raw = getRequestHeader("cf-connecting-ip") ?? getRequestHeader("x-forwarded-for") ?? getRequestHeader("x-real-ip");
    return raw ? raw.split(",")[0]!.trim() : null;
  } catch {
    return null;
  }
}

export const AGENT_ROLES = [
  "Compliance/KYC Officer",
  "Risk Manager",
  "Support Agent",
  "IT/DevOps Support",
  "Finance/Billing Agent",
  "Account Manager",
  "Auditor",
] as const;

export async function logAudit(
  db: any,
  actorId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
) {
  const { data: agent } = await db
    .from("agent_profiles").select("staff_id,full_name").eq("user_id", actorId).maybeSingle();
  await db.from("admin_audit_logs").insert({
    actor_id: actorId,
    actor_name: agent?.full_name ?? null,
    action,
    target_user_id: targetUserId,
    details: { staff_id: agent?.staff_id ?? null, ...details },
  });
}

/** Financial operations: Super Admins and Finance Admins only. */
export async function assertFinance(context: Ctx) {
  const roles = await myRoles(context);
  if (!roles.includes("admin") && !roles.includes("finance")) {
    throw new Error("Forbidden: finance permissions required.");
  }
}

/** Server helper: active signature for outbound replies. */
export async function appendSignature(db: any, userId: string, body: string) {
  const { data } = await db.from("agent_profiles").select("signature").eq("user_id", userId).maybeSingle();
  const sig = (data?.signature ?? "").trim();
  return sig && !body.trimEnd().endsWith(sig) ? `${body.trimEnd()}\n\n${sig}` : body;
}
