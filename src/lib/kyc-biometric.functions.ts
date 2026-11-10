import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, privileged } from "@/lib/desk.server";

export const deleteKycLivePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    id: z.string().uuid(), reason: z.string().trim().min(5).max(400),
  }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const db = await privileged();
    const { data: row, error } = await db.from("kyc_submissions")
      .select("user_id,level2_status,level2_selfie_path,level2_selfie_deleted_at")
      .eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Verification record not found.");
    if (row.level2_status !== "approved") throw new Error("Only approved Lv.2 captures can be deleted.");
    if (!row.level2_selfie_path && row.level2_selfie_deleted_at) return { ok: true };
    const path = row.level2_selfie_path;
    if (typeof path !== "string" || !path.startsWith(`${row.user_id}/level2-selfie-`) || path.split("/").length !== 2) {
      throw new Error("A valid private biometric capture was not found.");
    }
    // Remove the exact stored object, never a path provided by the caller.
    // A failed finalize can be retried: Storage remove is idempotent.
    const { error: storageError } = await db.storage.from("kyc-documents").remove([path]);
    if (storageError) throw new Error("Photo deletion failed. Approval and evidence records remain unchanged. Please retry.");
    const { error: finalizeError } = await db.rpc("finalize_kyc_biometric_purge", {
      p_id: data.id, p_actor: context.userId, p_expected_path: path, p_reason: data.reason,
    });
    if (finalizeError) throw new Error("The photo was removed, but its audit record could not be finalized. Retry this action to complete it.");
    return { ok: true };
  });