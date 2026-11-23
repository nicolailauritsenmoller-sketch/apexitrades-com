import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./desk.server", () => ({ assertAdmin: mocks.admin }));
import { listManagedOpenings, saveOpening, deleteOpening } from "./careers.functions";
beforeEach(() => vi.clearAllMocks());
for (const [name, fn] of [["list", listManagedOpenings], ["save", saveOpening], ["delete", deleteOpening]] as const) {
  it(`denies non-admin Careers ${name} before accessing openings`, async () => {
    mocks.admin.mockRejectedValue(new Error("Forbidden"));
    const from = vi.fn();
    await expect((fn as unknown as (v: unknown) => Promise<unknown>)({ context: { supabase: { from } }, data: {} })).rejects.toThrow("Forbidden");
    expect(from).not.toHaveBeenCalled();
  });
}
it("returns managed drafts to an authorized administrator", async () => {
  mocks.admin.mockResolvedValue(undefined);
  const draft = { id: "draft-id", status: "draft" };
  const limit = vi.fn().mockResolvedValue({ data: [draft], error: null });
  const from = vi.fn(() => ({ select: () => ({ order: () => ({ limit }) }) }));
  const result = await (listManagedOpenings as unknown as (v: unknown) => Promise<unknown>)({ context: { supabase: { from } } });
  expect(from).toHaveBeenCalledWith("careers_openings");
  expect(result).toEqual([draft]);
});