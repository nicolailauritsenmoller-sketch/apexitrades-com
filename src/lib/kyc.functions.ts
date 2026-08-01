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
    return {
      id: data.id,
      fullName: data.full_name,
      country: data.country,
      documentType: data.document_type,
      status: data.status as string,
      adminNote: data.admin_note,
      createdAt: data.created_at,
    };
  });

export const submitKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => submitInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("kyc_submissions").insert({
      user_id: context.userId,
      full_name: data.fullName,
      date_of_birth: data.dateOfBirth,
      country: data.country,
      address: data.address,
      document_type: data.documentType,
      document_number: data.documentNumber,
      document_path: data.documentPath,
      selfie_path: data.selfiePath,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
