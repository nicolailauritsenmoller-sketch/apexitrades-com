import { describe, expect, it } from "vitest";
import { filterOpenings, openingSchema, type CareerOpening } from "./careers-shared";

const base = { title: "Market Data Engineer", businessGroup: "Engineering", country: "United States", location: "New York", employmentType: "Full-time" as const, workMode: "Hybrid" as const, duration: "", tags: [], description: "Build reliable market data systems for trading.", requirements: "", applicationUrl: "", featured: false, status: "draft" as const };

describe("careers openings", () => {
  it("allows drafts without an application link", () => expect(openingSchema.safeParse(base).success).toBe(true));
  it("requires an application link before publishing", () => expect(openingSchema.safeParse({ ...base, status: "published" }).success).toBe(false));
  it("rejects insecure application links", () => expect(openingSchema.safeParse({ ...base, applicationUrl: "http://jobs.example.com" }).success).toBe(false));
  it("filters by title, country and job type", () => {
    const row = { id: "1", title: "Market Data Engineer", business_group: "Engineering", country: "United States", location: "New York", employment_type: "Full-time", work_mode: "Hybrid" } as CareerOpening;
    expect(filterOpenings([row], { q: "data", country: "United States", type: "Full-time" })).toHaveLength(1);
    expect(filterOpenings([row], { type: "Contract" })).toHaveLength(0);
  });
});
