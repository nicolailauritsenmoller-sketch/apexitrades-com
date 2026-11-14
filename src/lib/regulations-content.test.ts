import { describe, expect, it } from "vitest";
import { REGULATIONS_PAGE } from "./regulations-content";

describe("REGULATIONS_PAGE", () => {
  it("uses the exact title and subtitle", () => {
    expect(REGULATIONS_PAGE.title).toBe("Regulated Internationally");
    expect(REGULATIONS_PAGE.subtitle).toBe(
      "Velocity Trade’s subsidiaries are regulated and licensed in their local jurisdictions.",
    );
  });

  it("covers all eight jurisdictions in order", () => {
    expect(REGULATIONS_PAGE.jurisdictions.map((j) => j.country)).toEqual([
      "Australia",
      "Canada",
      "Europe",
      "New Zealand",
      "South Africa",
      "United Kingdom",
      "Singapore",
      "United States",
    ]);
  });

  it("carries the exact licence and registration numbers", () => {
    const details = REGULATIONS_PAGE.jurisdictions
      .flatMap((j) => j.badges.map((b) => b.detail))
      .join(" ");
    expect(details).toContain("AFSL) No. 329813");
    expect(details).toContain("FSP20003");
    expect(details).toContain("FSP) No. 43295");
    expect(details).toContain("Registered Number 497263");
  });

  it("names the required regulators and bodies", () => {
    const names = REGULATIONS_PAGE.jurisdictions
      .flatMap((j) => j.badges.map((b) => b.name))
      .join(" ");
    for (const required of [
      "ASIC",
      "ASX",
      "CIRO",
      "CIPF",
      "FINTRAC",
      "AFM",
      "FMA",
      "FSCA",
      "STRATE",
      "FCA",
      "MAS",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("lists the Canadian provinces of registration", () => {
    const canada = REGULATIONS_PAGE.jurisdictions.find((j) => j.id === "canada");
    for (const province of ["Alberta", "British Columbia", "Ontario", "Manitoba", "Quebec"]) {
      expect(canada?.summary).toContain(province);
    }
  });

  it("uses standard hyphens only, never em or en dashes", () => {
    const all = JSON.stringify(REGULATIONS_PAGE);
    expect(all).not.toMatch(/[—–]/);
  });
});
