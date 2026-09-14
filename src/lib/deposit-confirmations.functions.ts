import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DepositConfirmationView = {
  id: string;
  confirmations: number;
  required: number;
  status: string;
  tracked: boolean;
};

/**
 * Live confirmation progress for the caller's pending deposits. Deposits that
 * reach the required depth on their network are settled automatically.
 */
export const syncDepositConfirmations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ deposits: DepositConfirmationView[] }> => {
    const { syncUserDeposits } = await import("./deposit-settlement.server");
    try {
      return { deposits: await syncUserDeposits(context.userId) };
    } catch {
      return { deposits: [] };
    }
  });
