import { describe, expect, it } from "vitest";
import { filterSampleLeadTraders, sampleLeadTraders } from "./sample-lead-traders";

describe("sample lead traders", () => {
  it("provides 15,000 sample traders", () => {
    expect(sampleLeadTraders()).toHaveLength(15000);
  });
  it("paginates 20 per page", () => {
    const v = filterSampleLeadTraders(sampleLeadTraders(), "", 1);
    expect(v.rows).toHaveLength(20);
    expect(v.pages).toBe(750);
  });
  it("changes metrics between refresh buckets", () => {
    const a = sampleLeadTraders(1).find(r => r.id === "sample-5")!.roiPct;
    const b = sampleLeadTraders(2).find(r => r.id === "sample-5")!.roiPct;
    expect(a).not.toBe(b);
  });
  it("caps every 30-day volume below $500K across refresh buckets", () => {
    for (const bucket of [0, 1, 2, 999, 12345]) {
      for (const r of sampleLeadTraders(bucket)) {
        expect(r.managedVolume).toBeGreaterThanOrEqual(45_000);
        expect(r.managedVolume).toBeLessThan(500_000);
      }
    }
  });
});
