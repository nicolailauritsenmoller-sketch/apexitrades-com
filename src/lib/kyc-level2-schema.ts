import { z } from "zod";

export const level2Input = z.object({
  livenessSelfiePath: z.string().trim().min(1).max(300),
  livenessCapture: z.object({ source: z.literal("camera"), capturedAt: z.string().datetime(), width: z.number().int().positive(), height: z.number().int().positive(), device: z.string().max(200), movementChallenge: z.object({ kind: z.literal("head_turn"), assurance: z.literal("client_observed_movement"), direction: z.enum(["left", "right"]), completedAt: z.string().datetime(), durationMs: z.number().int().min(1800).max(45000) }).optional() }),
});

export function assertLevel2ReviewEvidence(row: {
  user_id: string; status: string; level2_status: string | null;
  level2_selfie_path: string | null; level2_selfie_capture: unknown;
}) {
  if (row.status !== "approved" || row.level2_status !== "pending") throw new Error("Lv.2 approval requires approved Lv.1 and a pending Lv.2 submission.");
  const capture = z.object({ source: z.literal("camera"), capturedAt: z.string().datetime() }).safeParse(row.level2_selfie_capture);
  if (!row.level2_selfie_path?.startsWith(`${row.user_id}/level2-selfie-`) || !capture.success) throw new Error("Lv.2 approval requires a live facial selfie and in-app camera metadata.");
}
