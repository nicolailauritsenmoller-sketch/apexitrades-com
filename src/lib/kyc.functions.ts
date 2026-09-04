import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitInput = z.object({
  fullName: z.string().trim().min(2).max(120),
  dateOfBirth: z.string().min(4).max(20),
  country: z.string().trim().min(2).max(80),
  address: z.string().trim().min(4).max(300),
  documentType: z.enum(["passport", "id_card", "drivers_license"]),
  documentNumber: z.string().trim().min(2).max(60),
  documentPath: z.string().trim().min(1).max(300),
  selfiePath: z.string().trim().min(1).max(300),
  documentExpiresAt: z.string().trim().min(4).max(20).optional(),
});

export const getMyKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data: signed } = await context.supabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, 300);
      return signed?.signedUrl ?? null;
    };

    const expiresAt = (data as { document_expires_at?: string | null }).document_expires_at ?? null;
    const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : false;

    return {
      id: data.id,
      fullName: data.full_name,
      country: data.country,
      documentType: data.document_type,
      documentNumber: data.document_number,
      status: data.status as string,
      adminNote: data.admin_note,
      createdAt: data.created_at,
      documentExpiresAt: expiresAt,
      expired,
      documentUrl: await sign(data.document_path),
      selfieUrl: await sign(data.selfie_path),
    };
  });

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitInput.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { error } = await context.supabase
        .from("kyc_submissions")
        .upsert(
          {
            user_id: context.userId,
            full_name: data.fullName,
            date_of_birth: data.dateOfBirth,
            country: data.country,
            address: data.address,
            document_type: data.documentType,
            document_number: data.documentNumber,
            document_path: data.documentPath,
            selfie_path: data.selfiePath,
            document_expires_at: data.documentExpiresAt || null,
            status: "pending",
            admin_note: null,
            reviewed_by: null,
            reviewed_at: null,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        throw new Error(
          error.message.includes("kyc_submissions_user_id_key")
            ? "Your verification details could not be saved. Please try again."
            : error.message,
        );
      }

      return {
        ok: true,
        message: "Your verification details have been updated and submitted for review.",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("kyc_submissions_user_id_key") || message.includes("duplicate key")) {
        throw new Error("Your verification details have been updated and submitted for review.");
      }
      throw new Error(
        message.includes("kyc_submissions")
          ? "Unable to save your verification details. Please check your inputs and try again."
          : message,
      );
    }
  });
