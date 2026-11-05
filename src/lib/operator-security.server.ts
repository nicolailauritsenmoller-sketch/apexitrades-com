export async function assertSensitiveOperator(context: { userId: string; claims?: Record<string, unknown> }) {
  const { isTwoFactorEnabled } = await import("./two-factor.server");
  if (!await isTwoFactorEnabled(context.userId)) throw new Error("Enable two-factor authentication in Profile > Security before this sensitive action.");
  const sessionId = context.claims?.['session_id'];
  if (typeof sessionId !== "string") throw new Error("Sign in again and verify two-factor authentication before this sensitive action.");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("two_factor_sessions").select("verified_at").eq("user_id", context.userId).eq("session_id", sessionId).maybeSingle();
  if (error || !data || !Number.isFinite(Date.parse(data.verified_at)) || Date.now() - Date.parse(data.verified_at) > 15 * 60_000) throw new Error("Verify two-factor authentication again before this sensitive action.");
}