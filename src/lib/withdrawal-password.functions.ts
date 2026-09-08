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
