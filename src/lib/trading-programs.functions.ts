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
    const { error } = await context.supabase.from("copy_leader_applications").insert({
      user_id: context.userId, public_name: data.publicName, bio: data.bio,
    });
    if (error) throw new Error(error.message);
    return { status: "pending" as const };
  });