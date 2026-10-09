import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertFinance, assertStaff, logAudit, privileged } from "./desk.server";
import { loadRiskControls } from "./risk-controls.server";

export const getRiskControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertStaff(context);
    return loadRiskControls();
  });

const patch = z.object({
  tradingPaused: z.boolean().optional(),
  maxLeverage: z.number().int().min(1).max(100).nullable().optional(),
  largeWithdrawalReview: z.boolean().optional(),
  largeWithdrawalThresholdUsd: z.number().min(100).max(10_000_000).optional(),
});

/** Changes one or more risk controls; Super Admin / Treasury Manager only, always audited. */
export const setRiskControls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ patch, reason: z.string().trim().min(5).max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertFinance(context);
    const before = await loadRiskControls();
    const next = { ...before, ...data.patch };
    const db = await privileged();
    const { error } = await db
      .from("platform_settings")
      .upsert({ key: "risk_controls", value: next, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    await logAudit(db, context.userId, "settings.risk_controls", null, { before, after: next, reason: data.reason });
    return next;
  });
