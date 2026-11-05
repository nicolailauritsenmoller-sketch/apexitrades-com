import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertAdmin: vi.fn(),
  privileged: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  audit: vi.fn(),
  result: { data: { user_id: "customer-id" }, error: null as { message: string } | null },
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = {
      middleware: () => builder,
      inputValidator: () => builder,
      handler: (handler: unknown) => handler,
    };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/desk.server", () => ({
  assertAdmin: mocks.assertAdmin,
  privileged: mocks.privileged,
  myRoles: vi.fn(), assertStaff: vi.fn(), assertFinance: vi.fn(),
  logAudit: vi.fn(), appendSignature: vi.fn(),
}));

import { unverifyKyc } from "./admin.functions";

const invoke = unverifyKyc as unknown as (args: {
  data: { id: string; note?: string };
  context: { userId: string; supabase: object };
}) => Promise<{ ok: boolean }>;

describe("Unverify user", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertAdmin.mockResolvedValue(undefined);
    mocks.result = { data: { user_id: "customer-id" }, error: null };
    const query = {
      update: mocks.update,
      eq: () => query,
      select: () => query,
      maybeSingle: async () => mocks.result,
    };
    mocks.update.mockReturnValue(query);
    mocks.from.mockImplementation((table: string) => {
      if (table === "kyc_submissions") return query;
      if (table === "admin_audit_logs") return { insert: mocks.audit };
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    });
    mocks.privileged.mockResolvedValue({ from: mocks.from });
  });

  const reverse = () => invoke({
    data: { id: "record-id", note: "Internal review reason" },
    context: { userId: "admin-id", supabase: {} },
  });

  it("resets Basic and Advanced to UNSUBMITTED together and requires fresh documents", async () => {
    await expect(reverse()).resolves.toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      status: "unsubmitted", kyc_level_1_status: "unsubmitted",
      level2_status: "unsubmitted", kyc_level_2_status: "unsubmitted",
      document_path: null, document_back_path: null, selfie_path: null, selfie_capture: null,
      level2_selfie_path: null, level2_selfie_capture: null, level2_proof_path: null,
      reviewed_by: null, reviewed_at: null, level2_reviewed_by: null,
      level2_reviewed_at: null, level2_submitted_at: null,
    }));
  });

  it("sends no customer messages and keeps the reason in the internal audit only", async () => {
    await reverse();
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual([
      "kyc_submissions", "profiles", "agent_profiles", "admin_audit_logs",
    ]);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ admin_note: null, level2_admin_note: null }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      action: "kyc.unverify", target_user_id: "customer-id",
      details: expect.objectContaining({ note: "Internal review reason" }),
    }));
  });

  it("rejects non-admins before reading or changing verification", async () => {
    mocks.assertAdmin.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(reverse()).rejects.toThrow("Forbidden");
    expect(mocks.privileged).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not record a successful reversal when the database update fails", async () => {
    mocks.result.error = { message: "Update failed" };
    await expect(reverse()).rejects.toThrow("Update failed");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});