import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Live confirmation progress for the caller's pending deposits. Deposits that
 * reach the required depth on their network are settled automatically.
 */
export const syncDepositConfirmations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { syncUserDeposits } = await import("./deposit-settlement.server");
    try {
      return { deposits: await syncUserDeposits(context.userId) };
    } catch {
      return { deposits: [] };
    }
  });
