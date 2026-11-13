import { describe, expect, it } from "vitest";
import { ANTI_FRAUD_NOTICE } from "./anti-fraud-content";

const allText = [
  ANTI_FRAUD_NOTICE.title,
  ANTI_FRAUD_NOTICE.summary,
  ANTI_FRAUD_NOTICE.officialDomain,
  ANTI_FRAUD_NOTICE.contactEmail,
  ...ANTI_FRAUD_NOTICE.jurisdictions,
  ...ANTI_FRAUD_NOTICE.sections.flatMap((s) => [s.heading, ...s.paragraphs, ...(s.bullets ?? [])]),
].join("\n");

describe("anti-fraud notice", () => {
  it("carries the exact institutional title", () => {
    expect(ANTI_FRAUD_NOTICE.title).toBe("VT Anti-Fraud and Impersonation Notice");
  });

  it("names the official domain and the security report contact", () => {
    expect(ANTI_FRAUD_NOTICE.officialDomain).toBe("https://velocititrade.com");
    expect(ANTI_FRAUD_NOTICE.contactEmail).toBe("fraud@velocititrade.com");
  });

  it("lists every licensed jurisdiction the notice claims", () => {
    expect(ANTI_FRAUD_NOTICE.jurisdictions).toEqual([
      "Australia",
      "New Zealand",
      "United Kingdom",
      "European Union",
      "United States",
      "Canada",
      "South Africa",
      "Singapore",
    ]);
  });

  it("states that no third-party platform is authorized to act for us", () => {
    expect(allText).toMatch(/does not operate through, nor does it authorize, any third-party/);
  });

  it("keeps the mandated section headings in reading order", () => {
    expect(ANTI_FRAUD_NOTICE.sections.map((s) => s.heading)).toEqual([
      "Warning regarding fraudulent websites and platforms",
      "Official domain verification",
      "Global regulatory context",
      "Vigilance guidelines against unsolicited communications",
      "Reporting a suspected scam",
    ]);
  });

  it("uses standard hyphens only, never em or en dashes", () => {
    expect(allText).not.toMatch(/[\u2013\u2014]/);
  });
});
