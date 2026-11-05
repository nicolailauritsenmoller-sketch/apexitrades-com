import { describe, expect, it } from "vitest";
import { assertLevel2ReviewEvidence, isRecentProofDate, level2Input, proofDateWindow } from "./kyc-level2-schema";

const selfie = {
  livenessSelfiePath: "user/level2-selfie-1.jpg",
  livenessCapture: { source: "camera", capturedAt: new Date().toISOString(), width: 640, height: 480, device: "camera" },
};
describe("Lv.2 compliance evidence", () => {
  const review = { user_id: "user", status: "approved", level2_status: "pending", level2_selfie_path: selfie.livenessSelfiePath, level2_selfie_capture: selfie.livenessCapture, level2_proof_path: null, level2_proof_type: null, level2_proof_issued_at: null };
  it("allows approval with live camera evidence and no optional address document", () => {
    expect(() => assertLevel2ReviewEvidence(review)).not.toThrow();
  });
  it("blocks approval without mandatory biometric camera evidence", () => {
    expect(() => assertLevel2ReviewEvidence({ ...review, level2_selfie_capture: null })).toThrow("live facial selfie");
  });
  it("blocks approval of address evidence older than three months", () => {
    expect(() => assertLevel2ReviewEvidence({ ...review, level2_proof_path: "user/level2-proof-1.pdf", level2_proof_type: "tax_document", level2_proof_issued_at: "2026-08-04" }, new Date("2026-11-05T02:19:00Z"))).toThrow("last 3 months");
  });
  it("allows submission without optional Proof of Address", () => {
    expect(level2Input.safeParse(selfie).success).toBe(true);
  });
  it("requires live facial capture", () => {
    expect(level2Input.safeParse({}).success).toBe(false);
    expect(level2Input.safeParse({ ...selfie, livenessCapture: { ...selfie.livenessCapture, source: "upload" } }).success).toBe(false);
  });
  it("requires a type and recent issue date if optional PoA is uploaded", () => {
    expect(level2Input.safeParse({ ...selfie, proofPath: "user/level2-proof-1.pdf" }).success).toBe(false);
    expect(level2Input.safeParse({ ...selfie, proofPath: "user/level2-proof-1.pdf", proofType: "bank_statement", proofIssuedAt: new Date().toISOString().slice(0, 10) }).success).toBe(true);
  });
  it("accepts exactly three calendar months and rejects older or future documents", () => {
    const now = new Date("2026-11-05T02:19:00Z");
    expect(isRecentProofDate("2026-08-05", now)).toBe(true);
    expect(isRecentProofDate("2026-08-04", now)).toBe(false);
    expect(isRecentProofDate("2026-11-06", now)).toBe(false);
    expect(isRecentProofDate("2026-02-30", now)).toBe(false);
    expect(proofDateWindow(new Date("2026-05-31T12:00:00Z")).min).toBe("2026-02-28");
  });
});