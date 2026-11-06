import { z } from "zod";

export const DEPOSIT_PROOF_REQUIRED = "Attach proof of payment / a transaction screenshot before submitting your deposit.";

export const depositInput = z.object({
  coin: z.string().min(1).max(12),
  network: z.string().min(1).max(48),
  amount: z.number().positive().max(100_000_000),
  txHash: z.string().trim().max(200).optional(),
  receiptPath: z.string({ required_error: DEPOSIT_PROOF_REQUIRED }).trim().min(1, DEPOSIT_PROOF_REQUIRED).max(400),
});