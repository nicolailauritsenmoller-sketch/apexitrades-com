import { expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { requestCreditSimulation } from "./institutional-credit.functions";

it("creates only a user-owned Treasury review ticket, never a wallet movement", async () => {
  const insert = vi.fn();
  const from = vi.fn(() => ({ insert: (row: unknown) => { insert(row); return { select: () => ({ single: async () => ({ data: { id: "ticket", reference: "VT-1", status: "open" }, error: null }) }) }; } }));
  const data = { collateralAsset: "BTC", collateralAmount: 1, collateralPrice: 100000, borrowingAsset: "USDT", borrowingPrice: 1, ltv: 70, rateModel: "fixed", fixedApr: 6, primeApr: 5, spread: 2 };
  await (requestCreditSimulation as unknown as (args: unknown) => Promise<unknown>)({ data, context: { userId: "actual-user", supabase: { from } } });
  expect(from.mock.calls.map(call => call[0])).toEqual(["support_tickets"]);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "actual-user", status: "open", subject: "Treasury Operations - Credit Facility Simulation" }));
});