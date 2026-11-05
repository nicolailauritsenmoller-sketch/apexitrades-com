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
});
