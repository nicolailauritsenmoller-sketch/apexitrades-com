import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getComplianceSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: roles, error: roleError } = await context.supabase.from("user_roles")
      .select("role").eq("user_id", context.userId);
    if (roleError || !roles?.some((row) => row.role === "admin")) throw new Error("Forbidden");
    const { data: row, error } = await context.supabase.from("kyc_submissions")
      .select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Submission not found.");
    return row;
  });