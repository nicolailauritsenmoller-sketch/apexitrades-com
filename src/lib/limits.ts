/** Minimum credit score a user must hold to request a withdrawal. */
export const MIN_WITHDRAWAL_CREDIT_SCORE = 500;

/** Credit score bounds used by both the admin tool and the user profile gauge. */
export const CREDIT_SCORE_MIN = 300;
export const CREDIT_SCORE_MAX = 850;

export function creditScoreBand(score: number): { label: string; tone: string } {
  if (score >= 800) return { label: "Excellent", tone: "text-bull" };
  if (score >= 740) return { label: "Very good", tone: "text-bull" };
  if (score >= 670) return { label: "Good", tone: "text-primary" };
  if (score >= 580) return { label: "Fair", tone: "text-amber-400" };
  return { label: "Restricted", tone: "text-bear" };
}
