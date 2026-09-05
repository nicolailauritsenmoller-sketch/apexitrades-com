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

const level2Input = z.object({
  livenessSelfiePath: z.string().trim().min(1).max(300),
  proofPath: z.string().trim().min(1).max(300),
  proofType: z.enum(["utility_bill", "bank_statement", "tax_document"]),
  taxId: z.string().trim().max(60).optional(),
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

    const row = data as Record<string, any>;
    const level1Status = data.status as string;
    const level2Status = (row["level2_status"] as string) ?? "unsubmitted";
    const verificationLevel =
      level1Status === "approved" ? (level2Status === "approved" ? 2 : 1) : 0;

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
      level1Status,
      level2Status,
      verificationLevel,
      level2AdminNote: (row["level2_admin_note"] as string | null) ?? null,
      level2SubmittedAt: (row["level2_submitted_at"] as string | null) ?? null,
      level2ProofType: (row["level2_proof_type"] as string | null) ?? null,
      level2TaxId: (row["level2_tax_id"] as string | null) ?? null,
      level2SelfieUrl: await sign((row["level2_selfie_path"] as string | null) ?? null),
      level2ProofUrl: await sign((row["level2_proof_path"] as string | null) ?? null),
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

/** Level 2 (enhanced) verification: liveness selfie + proof of address / tax ID. */
export const submitKycLevel2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => level2Input.parse(input))
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("kyc_submissions")
      .select("id,status,level2_status")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) throw new Error("Complete Level 1 verification first.");
    if (existing.status !== "approved") {
      throw new Error("Level 1 verification must be approved before applying for Level 2.");
    }
    if ((existing as any).level2_status === "pending") {
      throw new Error("Your Level 2 review is already in progress.");
    }
    if ((existing as any).level2_status === "approved") {
      throw new Error("Level 2 verification is already approved on this account.");
    }

    const { error } = await context.supabase
      .from("kyc_submissions")
      .upsert(
        {
          user_id: context.userId,
          level2_status: "pending",
          level2_selfie_path: data.livenessSelfiePath,
          level2_proof_path: data.proofPath,
          level2_proof_type: data.proofType,
          level2_tax_id: data.taxId || null,
          level2_submitted_at: new Date().toISOString(),
          level2_reviewed_at: null,
        } as any,
        { onConflict: "user_id" },
      );

    if (error) {
      throw new Error(
        error.message.includes("Level 1")
          ? "Level 1 verification must be approved before applying for Level 2."
          : "Unable to save your Level 2 documents. Please try again.",
      );
    }

    return { ok: true, message: "Level 2 documents submitted for compliance review." };
  });
