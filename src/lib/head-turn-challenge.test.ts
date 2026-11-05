import { describe, expect, it } from "vitest";
import { advanceHeadTurn, HOLD_MS, type ChallengeState } from "./head-turn-challenge";
describe("free head-turn movement challenge", () => {
  const initial: ChallengeState = { phase: "center", heldSince: null, startedAt: 0, direction: "right" };
  it("requires center, requested turn, and return held for 600ms each", () => {
    expect(HOLD_MS).toBe(600);
    let state = advanceHeadTurn(initial, 0, 0);
    state = advanceHeadTurn(state, 0, 600);
    expect(state.phase).toBe("turn");
    state = advanceHeadTurn(state, 0.3, 700);
    state = advanceHeadTurn(state, 0.3, 1300);
    expect(state.phase).toBe("return");
    state = advanceHeadTurn(state, 0, 1400);
    expect(advanceHeadTurn(state, 0, 2000).phase).toBe("complete");
  });
  it("does not accept a static face, opposite turn, or missing face", () => {
    const turn = { ...initial, phase: "turn" as const };
    expect(advanceHeadTurn(turn, 0, 10000).phase).toBe("turn");
    expect(advanceHeadTurn(turn, -0.3, 10000).heldSince).toBeNull();
    expect(advanceHeadTurn({ ...turn, heldSince: 0 }, null, 10000).heldSince).toBeNull();
  });
});