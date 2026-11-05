import { z } from "zod";

export function proofDateWindow(now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const start = new Date(`${today}T00:00:00Z`);
  const day = start.getUTCDate();
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - 3);
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  start.setUTCDate(Math.min(day, lastDay));
  return { min: start.toISOString().slice(0, 10), max: today };
}

export function isRecentProofDate(date: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
  const { min, max } = proofDateWindow(now);
  return date >= min && date <= max;
}

export const level2Input = z.object({
  livenessSelfiePath: z.string().trim().min(1).max(300),
  livenessCapture: z.object({ source: z.literal("camera"), capturedAt: z.string().datetime(), width: z.number().int().positive(), height: z.number().int().positive(), device: z.string().max(200) }),
  proofPath: z.string().trim().min(1).max(300).optional(),
  proofType: z.enum(["utility_bill", "bank_statement", "tax_document"]).optional(),
  proofIssuedAt: z.string().optional(),
  taxId: z.string().trim().max(60).optional(),
}).superRefine((data, ctx) => {
  if (data.proofPath && (!data.proofType || !data.proofIssuedAt || !isRecentProofDate(data.proofIssuedAt))) {
    ctx.addIssue({ code: "custom", path: ["proofIssuedAt"], message: "Proof of Address requires a document type and issue date within the last 3 months." });
  }
  if (!data.proofPath && (data.proofType || data.proofIssuedAt)) {
    ctx.addIssue({ code: "custom", path: ["proofPath"], message: "Upload the optional Proof of Address document or remove its details." });
  }
});