import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), privileged: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./desk.server", () => ({ assertAdmin: mocks.admin, privileged: mocks.privileged, logAudit: vi.fn() }));
import { saveVipEcosystem, reviewVipCredit } from "./vip-ecosystem.functions";
it("denies non-admin VIP configuration before privileged access", async () => {
  mocks.admin.mockRejectedValue(new Error("Forbidden"));
  await expect((saveVipEcosystem as unknown as (v: unknown) => Promise<unknown>)({ context: {}, data: {} })).rejects.toThrow("Forbidden");
  expect(mocks.privileged).not.toHaveBeenCalled();
});
it("denies non-admin credit approval before privileged access", async () => {
  mocks.admin.mockRejectedValue(new Error("Forbidden"));
  await expect((reviewVipCredit as unknown as (v: unknown) => Promise<unknown>)({ context: {}, data: {} })).rejects.toThrow("Forbidden");
  expect(mocks.privileged).not.toHaveBeenCalled();
});