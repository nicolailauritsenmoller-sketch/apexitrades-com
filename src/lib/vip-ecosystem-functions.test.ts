import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), privileged: vi.fn(), validators: [] as Array<(v: unknown) => unknown> }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: (fn: (v: unknown) => unknown) => { mocks.validators.push(fn); return b; }, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./desk.server", () => ({ assertAdmin: mocks.admin, privileged: mocks.privileged, logAudit: vi.fn() }));
import { saveVipEcosystem, reviewVipCredit } from "./vip-ecosystem.functions";
import { DEFAULT_VIP_ECOSYSTEM } from "./vip-ecosystem";
it("allows blank or omitted audit reasons when saving VIP controls", () => {
  const validate = mocks.validators[0];
  expect(validate({ config: DEFAULT_VIP_ECOSYSTEM, reason: "" })).toEqual({ config: DEFAULT_VIP_ECOSYSTEM, reason: "" });
  expect(validate({ config: DEFAULT_VIP_ECOSYSTEM })).toEqual({ config: DEFAULT_VIP_ECOSYSTEM, reason: "" });
});
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