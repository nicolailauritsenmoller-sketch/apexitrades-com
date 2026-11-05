import { describe, expect, it } from "vitest";
import { isRecentProofDate, level2Input, proofDateWindow } from "./kyc-level2-schema";

const selfie = {
  livenessSelfiePath: "user/level2-selfie-1.jpg",
  livenessCapture: { source: "camera", capturedAt: new Date().toISOString(), width: 640, height: 480, device: "camera" },
};
describe("Lv.2 compliance evidence", () => {
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