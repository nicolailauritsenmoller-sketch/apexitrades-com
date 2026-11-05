export type ChallengePhase = "center" | "turn" | "return" | "complete";
export type ChallengeState = { phase: ChallengePhase; heldSince: number | null; startedAt: number; direction: "left" | "right" };
export const HOLD_MS = 600;
export const CHALLENGE_TIMEOUT_MS = 45000;

/** Movement signal only, not presentation-attack detection or physical depth. */
export function advanceHeadTurn(state: ChallengeState, yaw: number | null, now: number): ChallengeState {
  if (state.phase === "complete") return state;
  const valid = yaw !== null && Number.isFinite(yaw) && (
    state.phase === "turn"
      ? (state.direction === "left" ? yaw < -0.22 : yaw > 0.22)
      : Math.abs(yaw) < 0.12
  );
  if (!valid) return { ...state, heldSince: null };
  if (state.heldSince === null) return { ...state, heldSince: now };
  if (now - state.heldSince < HOLD_MS) return state;
  return { ...state, heldSince: null, phase: state.phase === "center" ? "turn" : state.phase === "turn" ? "return" : "complete" };
}

export type HeadTurnEvidence = {
  kind: "head_turn";
  assurance: "client_observed_movement";
  direction: "left" | "right";
  completedAt: string;
  durationMs: number;
};