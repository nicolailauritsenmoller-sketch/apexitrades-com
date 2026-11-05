import { z } from "zod";

export const complianceAlertSchema = z.object({
  id: z.string().uuid(),
  submission_id: z.string().uuid(),
  user_name: z.string(),
  kind: z.literal("kyc_level2_submitted"),
  priority: z.literal("high"),
  created_at: z.string().datetime({ offset: true }),
});

export function complianceReviewSearch(submissionId: string) {
  return { tab: "users", review: z.string().uuid().parse(submissionId) };
}