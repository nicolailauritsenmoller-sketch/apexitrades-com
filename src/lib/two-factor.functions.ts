import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TwoFactorState = {
  enabled: boolean;
  method: "authenticator";
  verifiedAt: string | null;
  recoveryPhraseSet: boolean;
  sessionVerified: boolean;
};

const codeInput = (input: unknown) =>
  z.object({ code: z.string().min(6).max(200) }).parse(input);

function sessionIdOf(claims: Record<string, unknown>) {
  return (claims["session_id"] as string | undefined) ?? null;
}

/** Current 2FA status plus whether this sign-in session cleared the challenge. */
export const getTwoFactorState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { readState } = await import("./two-factor.server");
    return (await readState(context.userId, sessionIdOf(context.claims as any))) as TwoFactorState;
  });

/** Step 2 - issue a fresh TOTP secret and otpauth:// URI for the QR code. */
export const startTwoFactorSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { beginSetup } = await import("./two-factor.server");
    const email = ((context.claims as any)?.email as string | undefined) ?? context.userId;
    return beginSetup(context.userId, email);
  });

/** Step 3 - verify the first code, enable 2FA and return the 12-word recovery phrase. */
export const confirmTwoFactorSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { completeSetup } = await import("./two-factor.server");
    return completeSetup(context.userId, data.code, sessionIdOf(context.claims as any));
  });

/** Login interceptor - clears the challenge for this session. */
export const verifyTwoFactorChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { assertTotpValid, markSessionVerified, logSecurityEvent } = await import(
      "./two-factor.server"
    );
    const result = await assertTotpValid(context.userId, data.code);
    const sessionId = sessionIdOf(context.claims as any);
    if (sessionId) await markSessionVerified(context.userId, sessionId);
    await logSecurityEvent(context.userId, "2fa_challenge_passed", `Verified with ${result.method}.`);
    return { ok: true, method: result.method };
  });

/** Step-up verification for high-risk actions (email/password change, etc.). */
export const verifyStepUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { assertTotpValid, logSecurityEvent } = await import("./two-factor.server");
    await assertTotpValid(context.userId, data.code);
    await logSecurityEvent(context.userId, "2fa_step_up_passed", "High-risk action verified.");
    return { ok: true };
  });

export const disableTwoFactor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { disable } = await import("./two-factor.server");
    return disable(context.userId, data.code, sessionIdOf(context.claims as any));
  });

export const regenerateRecoveryPhrase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(codeInput)
  .handler(async ({ data, context }) => {
    const { regenerate } = await import("./two-factor.server");
    return regenerate(context.userId, data.code);
  });
