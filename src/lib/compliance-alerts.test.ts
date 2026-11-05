import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
  return builder;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { complianceAlertSchema, complianceReviewSearch } from "./compliance-alerts";
import { validateOperationsSearch } from "./operations-routing";
import { getComplianceSubmission } from "./compliance-alerts.functions";

const id = "11111111-1111-4111-8111-111111111111";
describe("Lv.2 compliance alerts", () => {
  it("accepts high-priority Lv.2 submission events only", () => {
    const alert = { id, submission_id: id, user_name: "Officer test", kind: "kyc_level2_submitted", priority: "high", created_at: "2026-11-05T03:00:00Z" };
    expect(complianceAlertSchema.safeParse(alert).success).toBe(true);
    expect(complianceAlertSchema.safeParse({ ...alert, priority: "low" }).success).toBe(false);
    expect(complianceAlertSchema.safeParse({ ...alert, kind: "kyc_level1_submitted" }).success).toBe(false);
  });
  it("targets the exact submission in the compliance desk", () => {
    expect(validateOperationsSearch(complianceReviewSearch(id))).toEqual({ tab: "users", review: id });
    expect(validateOperationsSearch({ tab: "overview", review: "invalid" })).toEqual({ tab: "overview" });
  });
  it("denies non-admins before reading compliance evidence", async () => {
    const from = vi.fn();
    const rpc = vi.fn(async () => ({ data: false, error: null }));
    const handler = getComplianceSubmission as unknown as (args: unknown) => Promise<unknown>;
    await expect(handler({ data: { id }, context: { userId: "officer", supabase: { rpc, from } } })).rejects.toThrow("Forbidden");
    expect(from).not.toHaveBeenCalled();
  });
  it("reads the selected submission for an authorized administrator", async () => {
    const row = { id, level2_status: "pending" };
    const eq = vi.fn(() => ({ maybeSingle: async () => ({ data: row, error: null }) }));
    const rpc = vi.fn(async () => ({ data: true, error: null }));
    const from = vi.fn(() => ({ select: () => ({ eq }) }));
    const handler = getComplianceSubmission as unknown as (args: unknown) => Promise<unknown>;
    expect(await handler({ data: { id }, context: { userId: "officer", supabase: { rpc, from } } })).toEqual(row);
    expect(eq).toHaveBeenCalledWith("id", id);
  });
});