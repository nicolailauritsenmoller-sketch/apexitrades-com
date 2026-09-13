import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Deterministic per-user hash so the raw withdrawal password never leaves the server. */
export async function hashWithdrawalPassword(userId: string, password: string) {
  const bytes = new TextEncoder().encode(`vt:${userId}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whether a withdrawal password is set, and when it was last changed. */
export const getWithdrawalPasswordStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("withdrawal_password_hash,withdrawal_password_updated_at")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      isSet: Boolean((data as any)?.withdrawal_password_hash),
      updatedAt: ((data as any)?.withdrawal_password_updated_at as string | null) ?? null,
    };
  });

export const setWithdrawalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        currentPassword: z.string().max(200).optional(),
        newPassword: z.string().min(6).max(64),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("withdrawal_password_hash")
      .eq("id", userId)
      .maybeSingle();

    const existing = (profile as any)?.withdrawal_password_hash as string | null;
    if (existing) {
      const provided = await hashWithdrawalPassword(userId, data.currentPassword ?? "");
      if (provided !== existing) throw new Error("Current withdrawal password is incorrect.");
    }

    const hash = await hashWithdrawalPassword(userId, data.newPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await (supabaseAdmin as any).rpc("set_withdrawal_password", {
      p_user_id: userId,
      p_password_hash: hash,
    });
    if (error) throw new Error(error.message);

    const payload = (result ?? {}) as { success?: boolean; message?: string };
    if (!payload.success) {
      throw new Error(payload.message ?? "Could not update your withdrawal password.");
    }
    return { ok: true, message: payload.message ?? "Withdrawal password updated." };
  });

/**
 * Recovery path for a forgotten withdrawal password. Re-authenticates with the
 * account password (plus an authenticator code when 2FA is on) and sets a new
 * withdrawal password immediately, bypassing the 7-working-day change cooldown.
 */
export const resetWithdrawalPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        accountPassword: z.string().min(1).max(200),
        newPassword: z.string().min(6).max(64),
        totpCode: z.string().max(32).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    const email = ((profile as any)?.email as string | null) ?? null;
    if (!email) throw new Error("No email on file for this account. Contact support.");

    const { createClient } = await import("@supabase/supabase-js");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
    const auth = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false },
      global: {
        fetch: (input: any, init: any) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: signIn, error: signInError } = await auth.auth.signInWithPassword({
      email,
      password: data.accountPassword,
    });
    if (signInError || signIn?.user?.id !== userId) {
      throw new Error("Account password is incorrect.");
    }
    await auth.auth.signOut();

    const { isTwoFactorEnabled, assertTotpValid } = await import("./two-factor.server");
    if (await isTwoFactorEnabled(userId)) {
      await assertTotpValid(userId, data.totpCode ?? "");
    }

    const hash = await hashWithdrawalPassword(userId, data.newPassword);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({
        withdrawal_password_hash: hash,
        withdrawal_password_updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return { ok: true, message: "Withdrawal password reset." };
  });
