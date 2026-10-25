import { z } from "zod";

export const programRequestSchema = z.object({
  program: z.enum(["copy_trading", "tournament", "liquidity"]),
  leaderId: z.string().uuid().nullable().default(null),
  budget: z.number().finite().min(0).max(1_000_000).default(0),
  leverage: z.union([z.literal(1), z.literal(2), z.literal(5), z.literal(10)]).default(1),
});
export const leaderApplicationSchema = z.object({
  publicName: z.string().trim().min(2).max(60),
  bio: z.string().trim().max(400),
  consent: z.literal(true),
});