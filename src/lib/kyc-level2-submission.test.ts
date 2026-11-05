import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => fn };
    return builder;
  },
}));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
import { submitKycLevel2 } from "./kyc.functions";
import { level2Input } from "./kyc-level2-schema";

describe("Lv.2 biometric-only persistence", () => {
  it("saves selfie and original capture metadata, marks the owner pending, and does not write PoA", async () => {
    const updateOwner = vi.fn(async () => ({ error: null }));
    const update = vi.fn(() => ({ eq: updateOwner }));
    const from = vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "submission", status: "approved", level2_status: "unsubmitted" } }) }) }),
      update,
    }));
    const data = level2Input.parse({
      livenessSelfiePath: "owner/level2-selfie-new.jpg",
      livenessCapture: { source: "camera", capturedAt: "2026-11-05T02:31:00Z", width: 640, height: 480, device: "camera" },
      proofPath: "ignored.pdf",
    });
    const handler = submitKycLevel2 as unknown as (args: { data: typeof data; context: { userId: string; supabase: { from: typeof from } } }) => Promise<{ ok: boolean }>;
    expect((await handler({ data, context: { userId: "owner", supabase: { from } } })).ok).toBe(true);
    expect(updateOwner).toHaveBeenCalledWith("user_id", "owner");
    const written = update.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(written).toMatchObject({ level2_status: "pending", level2_selfie_path: "owner/level2-selfie-new.jpg", level2_selfie_capture: data.livenessCapture, level2_reviewed_at: null });
    expect(Object.keys(written).filter((key) => key.includes("proof") || key.includes("tax"))).toEqual([]);
  });
});