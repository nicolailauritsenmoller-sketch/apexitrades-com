import { describe, expect, it } from "vitest";
import { assertLevel2ReviewEvidence, level2Input } from "./kyc-level2-schema";

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
  it("does not require or inspect retired address evidence during approval", () => {
    const legacy = { ...review, level2_proof_path: "legacy.pdf", level2_proof_type: "tax_document", level2_proof_issued_at: "2020-01-01" };
    expect(() => assertLevel2ReviewEvidence(legacy)).not.toThrow();
  });
  it("allows submission without optional Proof of Address", () => {
    expect(level2Input.safeParse(selfie).success).toBe(true);
  });
  it("requires live facial capture", () => {
    expect(level2Input.safeParse({}).success).toBe(false);
    expect(level2Input.safeParse({ ...selfie, livenessCapture: { ...selfie.livenessCapture, source: "upload" } }).success).toBe(false);
  });
  it("stores only biometric input, stripping retired address and tax fields", () => {
    expect(level2Input.parse({ ...selfie, proofPath: "legacy.pdf", proofType: "tax_document", proofIssuedAt: "2020-01-01", taxId: "old" })).toEqual(selfie);
  });
  it("preserves movement metadata without treating it as certified liveness", () => {
    const movementChallenge = { kind: "head_turn", assurance: "client_observed_movement", direction: "left", completedAt: new Date().toISOString(), durationMs: 2500 };
    expect(level2Input.parse({ ...selfie, livenessCapture: { ...selfie.livenessCapture, movementChallenge } }).livenessCapture.movementChallenge).toEqual(movementChallenge);
    expect(level2Input.safeParse({ ...selfie, livenessCapture: { ...selfie.livenessCapture, movementChallenge: { ...movementChallenge, assurance: "certified" } } }).success).toBe(false);
  });
  it("requires approved Lv.1 and pending Lv.2 before officer approval", () => {
    expect(() => assertLevel2ReviewEvidence({ ...review, status: "pending" })).toThrow("approved Lv.1");
    expect(() => assertLevel2ReviewEvidence({ ...review, level2_status: "unsubmitted" })).toThrow("pending Lv.2");
  });
});