import { z } from "zod";

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"] as const;
export const WORK_MODES = ["Remote", "Hybrid", "On-site"] as const;
export const OPENING_STATUSES = ["draft", "published", "closed"] as const;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const openingSchema = z.object({
  id: z.string().uuid().optional(),
  title: text(3, 180), businessGroup: text(2, 80), country: text(2, 80), location: text(2, 120),
  employmentType: z.enum(EMPLOYMENT_TYPES), workMode: z.enum(WORK_MODES), duration: z.string().trim().max(40),
  tags: z.array(text(1, 40)).max(12), description: text(20, 6000), requirements: z.string().trim().max(6000),
  applicationUrl: z.string().trim().max(500).refine(v => v === "" || /^https:\/\/\S+$/.test(v), "Use a secure https:// application link"),
  featured: z.boolean(), status: z.enum(OPENING_STATUSES),
}).refine(v => v.status !== "published" || v.applicationUrl !== "", { message: "Published openings need an application link", path: ["applicationUrl"] });
export type OpeningInput = z.infer<typeof openingSchema>;

export type CareerOpening = {
  id: string; title: string; business_group: string; country: string; location: string; employment_type: string;
  work_mode: string; duration: string; tags: string[]; description: string; requirements: string; application_url: string;
  featured: boolean; status: string; published_at: string | null; updated_at: string;
};

export function toOpeningRow(input: OpeningInput) {
  return { title: input.title, business_group: input.businessGroup, country: input.country, location: input.location,
    employment_type: input.employmentType, work_mode: input.workMode, duration: input.duration, tags: input.tags,
    description: input.description, requirements: input.requirements, application_url: input.applicationUrl,
    featured: input.featured, status: input.status };
}

export type CareerFilters = { q?: string; country?: string; location?: string; type?: string; group?: string };
export function filterOpenings(rows: CareerOpening[], f: CareerFilters) {
  const has = (v: string, part?: string) => !part || v.toLowerCase().includes(part.trim().toLowerCase());
  return rows.filter(r => has(r.title, f.q) && (!f.country || r.country === f.country) && has(`${r.location} ${r.work_mode}`, f.location)
    && (!f.type || r.employment_type === f.type) && (!f.group || r.business_group === f.group));
}
