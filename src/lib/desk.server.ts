/** Server-only helpers for the operations desk server functions. */

type Ctx = { supabase: any; userId: string };

export async function myRoles(context: Ctx): Promise<string[]> {
  // Read through the caller's own client first (RLS: users can read their own
  // roles). If that returns nothing — e.g. the row is only visible to the
  // service role — fall back to a service-role lookup scoped strictly to the
  // authenticated user id, never to a client-supplied value.
  console.log('[roles-debug] start', context.userId);
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
  console.log('[roles-debug]', context.userId, JSON.stringify({data, error: error?.message, fallback}));
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
  if (!roles.includes("admin")) throw new Error("Forbidden: admin access required.");
}

/** Service-role client — the only way privileged tables can be written. */
export async function privileged() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
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
  await db.from("admin_audit_logs").insert({
    actor_id: actorId,
    action,
    target_user_id: targetUserId,
    details,
  });
}
