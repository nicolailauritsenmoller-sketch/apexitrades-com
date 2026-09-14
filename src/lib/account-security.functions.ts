import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function hashSecurityValue(userId: string, value: string) {
  const input = new TextEncoder().encode(`velocity-security:${userId}:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type AccountSecurityState = {
  antiPhishingConfigured: boolean;
  antiPhishingHint: string | null;
  addressWhitelistingEnabled: boolean;
  loginPasswordUpdatedAt: string | null;
};

export const getAccountSecurityState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("account_security_settings")
      .select("anti_phishing_code_hash,anti_phishing_code_hint,address_whitelisting_enabled,login_password_updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      antiPhishingConfigured: Boolean(data?.anti_phishing_code_hash),
      antiPhishingHint: data?.anti_phishing_code_hint ?? null,
      addressWhitelistingEnabled: data?.address_whitelisting_enabled ?? false,
      loginPasswordUpdatedAt: data?.login_password_updated_at ?? null,
    } satisfies AccountSecurityState;
  });

export const setAntiPhishingCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().trim().min(4).max(32) }).parse(input))
  .handler(async ({ data, context }) => {
    const normalized = data.code.trim();
    const hash = await hashSecurityValue(context.userId, normalized);
    const { error } = await context.supabase.from("account_security_settings").upsert(
      {
        user_id: context.userId,
        anti_phishing_code_hash: hash,
        anti_phishing_code_hint: normalized.slice(-2),
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setAddressWhitelisting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("account_security_settings").upsert(
      { user_id: context.userId, address_whitelisting_enabled: data.enabled },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const recordLoginPasswordUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.from("account_security_settings").upsert(
      { user_id: context.userId, login_password_updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });