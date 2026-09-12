/** Server-only two-factor (TOTP) engine. Never import from client code. */
import {
  buildOtpAuthUri,
  generateBase32Secret,
  generateRecoveryCodes,
  hashRecoveryCode,
  verifyTotp,
} from "./totp.server";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const ISSUER = "Velocity Trade";

type SecurityRow = {
  user_id: string;
  two_factor_enabled: boolean;
  totp_secret: string | null;
  pending_totp_secret: string | null;
  two_factor_verified_at: string | null;
  last_totp_step: number | null;
  failed_attempts: number;
  locked_until: string | null;
};

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function getRow(userId: string): Promise<SecurityRow | null> {
  const client = await db();
  const { data } = await client.from("user_security").select("*").eq("user_id", userId).maybeSingle();
  return (data as SecurityRow | null) ?? null;
}

async function upsertRow(userId: string, patch: Record<string, unknown>) {
  const client = await db();
  const { error } = await client
    .from("user_security")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function logSecurityEvent(userId: string, event: string, detail?: string) {
  try {
    const client = await db();
    await client.from("security_logs").insert({ user_id: userId, event, detail: detail ?? null });
  } catch {
    /* logging must never break the flow */
  }
}

async function notifyUser(userId: string, title: string, body: string) {
  try {
    const client = await db();
    await client.from("notifications").insert({ user_id: userId, title, body, kind: "security" });
  } catch {
    /* best effort */
  }
}

function assertNotLocked(row: SecurityRow | null) {
  if (row?.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const mins = Math.max(1, Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000));
    throw new Error(`Too many incorrect codes. Try again in ${mins} minute(s).`);
  }
}

async function registerFailure(userId: string, row: SecurityRow | null) {
  const attempts = (row?.failed_attempts ?? 0) + 1;
  const locked =
    attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await upsertRow(userId, {
    failed_attempts: locked ? 0 : attempts,
    locked_until: locked,
  });
  if (locked) throw new Error(`Too many incorrect codes. Try again in ${LOCK_MINUTES} minutes.`);
}

/** Consume a single-use recovery code. Returns true when one matched. */
async function consumeRecoveryCode(userId: string, code: string) {
  const cleaned = code.replace(/[^A-Za-z0-9]/g, "");
  if (cleaned.length < 8) return false;
  const hash = await hashRecoveryCode(userId, cleaned);
  const client = await db();
  const { data } = await client
    .from("user_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("code_hash", hash)
    .is("used_at", null)
    .select("id");
  return Array.isArray(data) && data.length > 0;
}

/**
 * Validate a TOTP token (or recovery code) for a user with 2FA enabled.
 * Rejects replays of an already-used time step and rate-limits failures.
 */
export async function assertTotpValid(userId: string, code: string) {
  const row = await getRow(userId);
  if (!row?.two_factor_enabled || !row.totp_secret) {
    throw new Error("Two-factor authentication is not enabled on this account.");
  }
  assertNotLocked(row);

  const token = (code ?? "").trim();
  if (!token) throw new Error("Enter your 6-digit authenticator code.");

  if (/^\d{6}$/.test(token)) {
    const result = await verifyTotp(row.totp_secret, token, { afterStep: row.last_totp_step });
    if (result.valid) {
      await upsertRow(userId, { last_totp_step: result.step, failed_attempts: 0, locked_until: null });
      return { method: "totp" as const };
    }
  } else if (await consumeRecoveryCode(userId, token)) {
    await upsertRow(userId, { failed_attempts: 0, locked_until: null });
    await logSecurityEvent(userId, "2fa_recovery_code_used", "A single-use recovery code was consumed.");
    return { method: "recovery" as const };
  }

  await registerFailure(userId, row);
  throw new Error("That code is not valid. Check your authenticator app and try again.");
}

export async function isTwoFactorEnabled(userId: string) {
  const row = await getRow(userId);
  return Boolean(row?.two_factor_enabled && row.totp_secret);
}

export async function readState(userId: string, sessionId: string | null) {
  const row = await getRow(userId);
  const client = await db();
  const enabled = Boolean(row?.two_factor_enabled && row.totp_secret);

  let recoveryRemaining = 0;
  if (enabled) {
    const { count } = await client
      .from("user_recovery_codes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("used_at", null);
    recoveryRemaining = count ?? 0;
  }

  let sessionVerified = !enabled;
  if (enabled && sessionId) {
    const { data } = await client
      .from("two_factor_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("session_id", sessionId)
      .maybeSingle();
    sessionVerified = Boolean(data);
  }

  return {
    enabled,
    method: "authenticator" as const,
    verifiedAt: row?.two_factor_verified_at ?? null,
    recoveryRemaining,
    sessionVerified,
  };
}

export async function beginSetup(userId: string, account: string) {
  const row = await getRow(userId);
  if (row?.two_factor_enabled) throw new Error("Two-factor authentication is already enabled.");
  const secret = generateBase32Secret();
  await upsertRow(userId, { pending_totp_secret: secret, two_factor_enabled: false });
  return {
    secret,
    otpauthUri: buildOtpAuthUri({ secret, account, issuer: ISSUER }),
  };
}

export async function completeSetup(userId: string, code: string, sessionId: string | null) {
  const row = await getRow(userId);
  if (!row?.pending_totp_secret) throw new Error("Start the setup again to get a fresh setup key.");
  assertNotLocked(row);

  const result = await verifyTotp(row.pending_totp_secret, code);
  if (!result.valid) {
    await registerFailure(userId, row);
    throw new Error("That code is not valid. Make sure your device clock is correct and try again.");
  }

  const codes = generateRecoveryCodes(10);
  const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(userId, c)));
  const client = await db();
  await client.from("user_recovery_codes").delete().eq("user_id", userId);
  await client
    .from("user_recovery_codes")
    .insert(hashes.map((code_hash) => ({ user_id: userId, code_hash })));

  await upsertRow(userId, {
    two_factor_enabled: true,
    totp_secret: row.pending_totp_secret,
    pending_totp_secret: null,
    two_factor_verified_at: new Date().toISOString(),
    last_totp_step: result.step,
    failed_attempts: 0,
    locked_until: null,
  });

  if (sessionId) await markSessionVerified(userId, sessionId);
  await logSecurityEvent(userId, "2fa_enabled", "Authenticator app two-factor authentication enabled.");
  await notifyUser(
    userId,
    "Two-factor authentication enabled",
    "An authenticator app is now required to sign in to your Velocity Trade account. If this wasn't you, contact support immediately.",
  );

  return { recoveryCodes: codes };
}

export async function markSessionVerified(userId: string, sessionId: string) {
  const client = await db();
  await client
    .from("two_factor_sessions")
    .upsert(
      { user_id: userId, session_id: sessionId, verified_at: new Date().toISOString() },
      { onConflict: "user_id,session_id" },
    );
}

export async function disable(userId: string, code: string, currentSessionId: string | null) {
  await assertTotpValid(userId, code);
  const client = await db();

  await upsertRow(userId, {
    two_factor_enabled: false,
    totp_secret: null,
    pending_totp_secret: null,
    two_factor_verified_at: null,
    last_totp_step: null,
    failed_attempts: 0,
    locked_until: null,
  });
  await client.from("user_recovery_codes").delete().eq("user_id", userId);
  await client.from("two_factor_sessions").delete().eq("user_id", userId);

  // Terminate every other session so a stolen session cannot survive the change.
  try {
    await client.auth.admin.signOut(userId, "others");
  } catch {
    /* best effort */
  }
  try {
    await client
      .from("user_sessions")
      .update({ is_online: false })
      .eq("user_id", userId)
      .neq("device_id", currentSessionId ?? "");
  } catch {
    /* best effort */
  }

  await logSecurityEvent(userId, "2fa_disabled", "Authenticator app two-factor authentication disabled.");
  await notifyUser(
    userId,
    "Two-factor authentication disabled",
    "Two-factor authentication was turned off and other sessions were signed out. If this wasn't you, secure your account now.",
  );
  return { ok: true };
}

export async function regenerate(userId: string, code: string) {
  await assertTotpValid(userId, code);
  const codes = generateRecoveryCodes(10);
  const hashes = await Promise.all(codes.map((c) => hashRecoveryCode(userId, c)));
  const client = await db();
  await client.from("user_recovery_codes").delete().eq("user_id", userId);
  await client
    .from("user_recovery_codes")
    .insert(hashes.map((code_hash) => ({ user_id: userId, code_hash })));
  await logSecurityEvent(userId, "2fa_recovery_codes_regenerated", "New recovery codes issued.");
  return { recoveryCodes: codes };
}
