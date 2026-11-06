import { describe, expect, it, vi } from "vitest";
const { adminRpc, wallets, usdtRates } = vi.hoisted(() => ({ adminRpc: vi.fn(), wallets: { data: [{ currency: "USDT", balance: 9_999 }], error: null }, usdtRates: vi.fn(async () => ({ USDT: 1 })) }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./rates.server", () => ({ usdtRates }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: adminRpc } }));
import { requestPrimeAllocation } from "./prime-membership.functions";
const context = { userId: "11111111-1111-4111-8111-111111111111", supabase: {
  from: () => ({ select: () => ({ eq: async () => wallets }) }),
  rpc: async (name: string) => ({ data: name === "get_vip_ecosystem_config" ? {} : [{ level: 1, min_portfolio_usdt: 10_000, min_collateral_usdt: 0, min_eth_holdings: 0 }], error: null }),
} };
const handler = requestPrimeAllocation as unknown as (args: { context: typeof context; data: { level: number } }) => Promise<unknown>;
describe("Live collateral eligibility", () => {
  it("rejects Retail Prime requests below 10,000 USDT without creating a recommendation", async () => {
    await expect(handler({ context, data: { level: 1 } })).rejects.toThrow("Minimum collateral requirement");
    expect(adminRpc).not.toHaveBeenCalled();
  });
  it("accepts exactly 10,000 cleared USDT and records pending review", async () => {
    wallets.data[0].balance = 10_000;
    adminRpc.mockResolvedValue({ data: "pending", error: null });
    expect(await handler({ context, data: { level: 1 } })).toEqual({ status: "pending" });
    expect(adminRpc).toHaveBeenCalledWith("request_prime_allocation", { p_user_id: context.userId, p_level: 1 });
  });
});