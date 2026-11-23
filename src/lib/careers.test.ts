import { describe, expect, it } from "vitest";
import { filterOpenings, openingSchema, type CareerOpening } from "./careers-shared";

const base = { title: "Market Data Engineer", businessGroup: "Engineering", country: "United States", location: "New York", employmentType: "Full-time" as const, workMode: "Hybrid" as const, duration: "", tags: [], description: "Build reliable market data systems for trading.", requirements: "", applicationUrl: "", featured: false, status: "draft" as const };

describe("careers openings", () => {
  it("allows drafts without an application link", () => expect(openingSchema.safeParse(base).success).toBe(true));
  it("requires an application link before publishing", () => expect(openingSchema.safeParse({ ...base, status: "published" }).success).toBe(false));
  it("rejects insecure application links", () => expect(openingSchema.safeParse({ ...base, applicationUrl: "http://jobs.example.com" }).success).toBe(false));
  it("accepts a published opening with a secure application destination", () => expect(openingSchema.safeParse({ ...base, status: "published", applicationUrl: "https://jobs.example.com/apply" }).success).toBe(true));
  it("allows a closed opening without an application link", () => expect(openingSchema.safeParse({ ...base, status: "closed" }).success).toBe(true));
  it("combines location and business-group filters", () => {
    const row = { id: "1", title: "Engineer", business_group: "Engineering", country: "Canada", location: "Toronto", employment_type: "Full-time", work_mode: "Remote" } as CareerOpening;
    expect(filterOpenings([row], { location: "remote", group: "Engineering" })).toHaveLength(1);
    expect(filterOpenings([row], { location: "remote", group: "Operations" })).toHaveLength(0);
  });
  it("filters by title, country and job type", () => {
    const row = { id: "1", title: "Market Data Engineer", business_group: "Engineering", country: "United States", location: "New York", employment_type: "Full-time", work_mode: "Hybrid" } as CareerOpening;
    expect(filterOpenings([row], { q: "data", country: "United States", type: "Full-time" })).toHaveLength(1);
    expect(filterOpenings([row], { type: "Contract" })).toHaveLength(0);
  });
});
