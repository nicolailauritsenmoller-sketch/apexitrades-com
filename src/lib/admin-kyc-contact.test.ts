import { describe, expect, it, vi } from "vitest";

const { assertAdmin } = vi.hoisted(() => ({ assertAdmin: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/desk.server", () => ({
  assertAdmin, myRoles: vi.fn(), assertStaff: vi.fn(), assertFinance: vi.fn(),
  privileged: vi.fn(), logAudit: vi.fn(), appendSignature: vi.fn(),
}));

import { getKycDocumentUrls } from "./admin.functions";

describe("Compliance inspection contact", () => {
  it("reads the registered email from the profile belonging to the submission", async () => {
    const profileId = vi.fn();
    const selectProfile = vi.fn(() => ({ eq: profileId }));
    profileId.mockReturnValue({ maybeSingle: async () => ({ data: { email: "registered@example.com" }, error: null }) });
    const from = vi.fn((table: string) => table === "profiles"
      ? { select: selectProfile }
      : { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
        user_id: "submission-owner", document_path: null, selfie_path: null,
        level2_selfie_path: null, level2_proof_path: null,
      } }) }) }) });
    const handler = getKycDocumentUrls as unknown as (args: {
      data: { id: string }; context: { userId: string; supabase: { from: typeof from } };
    }) => Promise<{ registeredEmail: string | null }>;
    const result = await handler({ data: { id: "submission-id" }, context: { userId: "officer", supabase: { from } } });
    expect(assertAdmin).toHaveBeenCalled();
    expect(selectProfile).toHaveBeenCalledWith("email");
    expect(profileId).toHaveBeenCalledWith("id", "submission-owner");
    expect(result.registeredEmail).toBe("registered@example.com");
  });
});