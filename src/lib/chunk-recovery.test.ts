import { describe, expect, it } from "vitest";
import { claimChunkRecovery, isChunkLoadError } from "./chunk-recovery";

describe("stale route chunk recovery", () => {
  it("recognizes the reported missing route module without swallowing unrelated errors", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: /assets/route-BdJJiVpq.js"))).toBe(true);
    expect(isChunkLoadError(new Error("Insufficient balance"))).toBe(false);
  });
  it("allows one refresh and blocks repeated refreshes for 60 seconds", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(claimChunkRecovery(storage, 100_000)).toBe(true);
    expect(claimChunkRecovery(storage, 100_001)).toBe(false);
    expect(claimChunkRecovery(storage, 159_999)).toBe(false);
    expect(claimChunkRecovery(storage, 160_000)).toBe(true);
  });
});