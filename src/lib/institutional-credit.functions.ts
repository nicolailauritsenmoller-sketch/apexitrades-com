import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { creditScenarioSchema, creditRequestBody } from "./institutional-credit";

export const requestCreditSimulation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => creditScenarioSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: ticket, error } = await context.supabase.from("support_tickets").insert({
      user_id: context.userId,
      subject: "Treasury Operations - Credit Facility Simulation",
      body: creditRequestBody(data), category: "wallet", priority: "normal", status: "open",
    }).select("id,reference,status").single();
    if (error || !ticket) throw new Error("Could not submit the credit scenario. Please retry.");
    return ticket;
  });