import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), staff: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/desk.server", () => ({ privileged: async () => ({ from: mocks.from, rpc: mocks.rpc }), assertStaff: mocks.staff, logAudit: vi.fn(), appendSignature: vi.fn() }));
import { getVipDirectory, getVipThread, sendVipMessage, updateVipThread } from "./vip.functions";
let tables: Record<string, unknown[]>;
beforeEach(() => {
  vi.clearAllMocks();
  tables = { agent_profiles: [{ user_id: "agent", full_name: "Secret Agent", avatar_url: "private-avatar" }], vip_access: [{ role_key: "billing_settlements", unlocked: false }], vip_messages: [] };
  mocks.from.mockImplementation((table: string) => { const b: any = { then: (resolve: any) => Promise.resolve({ data: tables[table] ?? [], error: null }).then(resolve) }; for (const key of ["select", "eq", "order", "limit", "update", "neq", "is"]) b[key] = () => b; b.maybeSingle = async () => ({ data: tables[table]?.[0] ?? null, error: null }); return b; });
});
const context = { userId: "customer", supabase: {} };
it("pending directory response contains no specialist identity", async () => {
  const result = await (getVipDirectory as any)({ context });
  expect(JSON.stringify(result)).not.toContain("Secret Agent");
  expect(JSON.stringify(result)).not.toContain("private-avatar");
  expect(result[0].agent).toBeNull();
});
it("pending customer cannot fetch or send thread messages", async () => {
  expect(await (getVipThread as any)({ context, data: { roleKey: "billing_settlements" } })).toEqual([]);
  await expect((sendVipMessage as any)({ context, data: { roleKey: "billing_settlements", body: "test" } })).rejects.toThrow("accept and join");
});
it("nonstaff cannot accept a queued request", async () => {
  mocks.staff.mockRejectedValueOnce(new Error("Forbidden"));
  await expect((updateVipThread as any)({ context, data: { userId: "customer", roleKey: "billing_settlements", action: "assign" } })).rejects.toThrow("Forbidden");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("a competing staff acceptance fails rather than overwriting assignment", async () => {
  mocks.rpc.mockResolvedValue({ data: false, error: null });
  await expect((updateVipThread as any)({ context, data: { userId: "customer", roleKey: "billing_settlements", action: "assign" } })).rejects.toThrow("already accepted");
});