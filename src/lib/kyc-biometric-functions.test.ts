import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  authorize: vi.fn(), privileged: vi.fn(), remove: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  row: { user_id: "customer", level2_status: "approved", level2_selfie_path: "customer/level2-selfie-live.jpg", level2_selfie_deleted_at: null as string | null },
}));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const b = { middleware: () => b, inputValidator: () => b, handler: (h: unknown) => h }; return b;
} }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/desk.server", () => ({ assertAdmin: m.authorize, privileged: m.privileged }));
import { deleteKycLivePhoto } from "./kyc-biometric.functions";
const invoke = deleteKycLivePhoto as unknown as (args: { data: { id: string; reason: string }; context: { userId: string } }) => Promise<{ ok: boolean }>;
const run = () => invoke({ data: { id: "submission", reason: "Approved retention policy purge" }, context: { userId: "officer" } });

describe("Approved Lv.2 photo privacy deletion", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    m.row = { user_id: "customer", level2_status: "approved", level2_selfie_path: "customer/level2-selfie-live.jpg", level2_selfie_deleted_at: null };
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: m.row, error: null }) };
    m.from.mockReturnValue(q);
    m.remove.mockResolvedValue({ error: null }); m.rpc.mockResolvedValue({ error: null });
    m.privileged.mockResolvedValue({ from: m.from, storage: { from: () => ({ remove: m.remove }) }, rpc: m.rpc });
  });
  it("rejects non-administrators before accessing private evidence", async () => {
    m.authorize.mockRejectedValue(new Error("Forbidden"));
    await expect(run()).rejects.toThrow("Forbidden"); expect(m.privileged).not.toHaveBeenCalled();
  });
  it("only permits approved Lv.2 profiles", async () => {
    m.row.level2_status = "pending";
    await expect(run()).rejects.toThrow("Only approved Lv.2"); expect(m.remove).not.toHaveBeenCalled();
  });
  it("permanently removes the stored live photo and finalizes the private audit", async () => {
    await expect(run()).resolves.toEqual({ ok: true });
    expect(m.remove).toHaveBeenCalledWith(["customer/level2-selfie-live.jpg"]);
    expect(m.rpc).toHaveBeenCalledWith("finalize_kyc_biometric_purge", { p_id: "submission", p_actor: "officer", p_expected_path: "customer/level2-selfie-live.jpg", p_reason: "Approved retention policy purge" });
    expect(m.from).toHaveBeenCalledTimes(1); // No customer notifications.
  });
  it("rejects another customer's image path", async () => {
    m.row.level2_selfie_path = "other/level2-selfie-live.jpg";
    await expect(run()).rejects.toThrow("valid private biometric"); expect(m.remove).not.toHaveBeenCalled();
  });
  it("leaves evidence records untouched on storage failure", async () => {
    m.remove.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(run()).rejects.toThrow("records remain unchanged"); expect(m.rpc).not.toHaveBeenCalled();
  });
  it("reports incomplete audit finalization rather than claiming success", async () => {
    m.rpc.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(run()).rejects.toThrow("Retry this action");
  });
  it("allows safe retries of a completed deletion", async () => {
    m.row.level2_selfie_path = ""; m.row.level2_selfie_deleted_at = "2026-11-10T08:33:00Z";
    await expect(run()).resolves.toEqual({ ok: true }); expect(m.remove).not.toHaveBeenCalled();
  });
});