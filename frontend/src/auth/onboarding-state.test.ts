import { describe, expect, it } from "vitest";
import { completeOnboarding, hasPendingOnboarding, markOnboardingPending } from "./onboarding-state";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, value); },
  };
}

describe("profile onboarding state", () => {
  it("tracks a new profile until the guide is completed", () => {
    const storage = memoryStorage();
    markOnboardingPending("player-1", storage);
    expect(hasPendingOnboarding("player-1", storage)).toBe(true);
    completeOnboarding("player-1", storage);
    expect(hasPendingOnboarding("player-1", storage)).toBe(false);
  });

  it("does not treat existing profiles without a marker as pending", () => {
    expect(hasPendingOnboarding("existing-player", memoryStorage())).toBe(false);
  });
});
