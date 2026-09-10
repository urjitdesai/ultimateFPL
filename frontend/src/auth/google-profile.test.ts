import type { User } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError, type Profile } from "../api";
import { googleLoginDestination, lookupGoogleProfile } from "./google-profile";

const user = {} as User;

describe("Google profile lookup", () => {
  afterEach(() => vi.restoreAllMocks());

  it("identifies an authenticated Google user without an app profile", async () => {
    vi.spyOn(api, "profile").mockRejectedValue(new ApiError("Complete your profile to continue.", 404, "PROFILE_NOT_FOUND"));
    await expect(lookupGoogleProfile(user)).resolves.toEqual({ kind: "missing" });
  });

  it("returns an existing app profile", async () => {
    const profile = { uid: "google-user" } as Profile;
    vi.spyOn(api, "profile").mockResolvedValue(profile);
    await expect(lookupGoogleProfile(user)).resolves.toEqual({ kind: "existing", profile });
  });

  it("starts profile setup when Google login finds no app profile", () => {
    expect(googleLoginDestination({ kind: "missing" }, false)).toBe("/complete-profile");
  });

  it("routes existing Google users according to their onboarding state", () => {
    const profile = { uid: "google-user" } as Profile;
    const result = { kind: "existing", profile } as const;
    expect(googleLoginDestination(result, true)).toBe("/onboarding");
    expect(googleLoginDestination(result, false)).toBe("/dashboard");
  });
});
