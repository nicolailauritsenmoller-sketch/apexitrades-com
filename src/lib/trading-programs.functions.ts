import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { leaderApplicationSchema, programRequestSchema } from "./trading-programs";

export const getTradingPrograms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [leaders, requests, application] = await Promise.all([
      context.supabase.rpc("copy_leader_directory"),
      context.supabase.from("trading_program_requests").select("*").eq("user_id", context.userId),
      context.supabase.from("copy_leader_applications").select("*").eq("user_id", context.userId).maybeSingle(),
    ]);
    for (const result of [leaders, requests, application]) if (result.error) throw new Error(result.error.message);
    return { leaders: leaders.data ?? [], requests: requests.data ?? [], application: application.data };
  });

export const saveProgramRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => programRequestSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("trading_program_requests").upsert({
      user_id: context.userId, program: data.program, leader_id: data.leaderId,
      requested_budget: data.budget, leverage: data.leverage,
    }, { onConflict: "user_id,program" });
    if (error) throw new Error(error.message);
    return { status: "pending" as const };
  });

export const applyAsCopyLeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => leaderApplicationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const current = await context.supabase.from("copy_leader_applications").select("status").eq("user_id", context.userId).maybeSingle();
    if (current.error) throw new Error(current.error.message);
    const status = current.data?.status as string | undefined;
    // An application already under review or past a decision other than rejection is left untouched.
    if (status && status !== "rejected") return { status, resubmitted: false };
    const submitted = {
      public_name: data.publicName, bio: data.bio, status: "pending" as const,
      consent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    // A rejected applicant may revise and resubmit; the database only permits that transition.
    const { error } = status === "rejected"
      ? await context.supabase.from("copy_leader_applications").update(submitted).eq("user_id", context.userId)
      : await context.supabase.from("copy_leader_applications").insert({ user_id: context.userId, ...submitted });
    if (error) throw new Error(error.message);
    return { status: "pending" as const, resubmitted: status === "rejected" };
  });