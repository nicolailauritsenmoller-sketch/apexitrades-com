import { describe, expect, it } from "vitest";
import { listingAction } from "./listing-actions";

describe("internal listing actions", () => {
  it("opens the internal terminal for listed catalog markets", () => {
    expect(listingAction("listed", true)).toBe("terminal");
  });
  it("keeps unsupported listed markets in the internal preview", () => {
    expect(listingAction("listed", false)).toBe("preview");
  });
  it("does not authorize upcoming markets even when they are in the catalog", () => {
    expect(listingAction("announced", true)).toBe("preview");
    expect(listingAction("announced", false)).toBe("preview");
  });
});