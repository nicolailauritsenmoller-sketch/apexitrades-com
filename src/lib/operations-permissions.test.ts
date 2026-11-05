import { expect, it, vi } from "vitest";
import { assertAdmin, assertFinance, myRoles } from "./desk.server";
function context(roles: string[], error: unknown = null) {
  return { userId: "user", supabase: { from: vi.fn(() => ({ select: () => ({ eq: async () => ({ data: roles.map(role => ({ role })), error }) }) })) } };
}
it("ordinary traders cannot open protected operations health", async () => {
  await expect(assertAdmin(context(["user"]))).rejects.toThrow("Forbidden");
});
it("finance operators cannot restore global configurations", async () => {
  await expect(assertAdmin(context(["finance"]))).rejects.toThrow("Forbidden");
});
it("support operators cannot approve money movement", async () => {
  await expect(assertFinance(context(["agent"]))).rejects.toThrow("Forbidden");
});
it("role-read failures fail closed without privileged fallback", async () => {
  await expect(myRoles(context([], { message: "failed" }))).rejects.toThrow("Could not verify staff permissions");
});
it("authorized administrator retains access", async () => {
  await expect(assertAdmin(context(["admin"]))).resolves.toBeUndefined();
});