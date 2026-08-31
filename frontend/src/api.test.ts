import type { User } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

describe("gameweek submission API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends predictions, captain, and wager in one request", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { predictions: {}, wager: {} } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = { getIdToken: vi.fn().mockResolvedValue("firebase-token") } as unknown as User;
    const predictions = [{
      fixtureId: "fixture-1",
      predictedHomeScore: 2,
      predictedAwayScore: 1,
    }];

    await api.saveGameweekSubmission(
      user,
      "gameweek-1",
      predictions,
      "fixture-1",
      { fixtureId: "fixture-1", stakePoints: 10 },
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/gameweeks\/gameweek-1\/submission$/);
    expect(request).toMatchObject({
      method: "PUT",
      headers: {
        authorization: "Bearer firebase-token",
        "content-type": "application/json",
      },
    });
    expect(JSON.parse(String(request.body))).toEqual({
      predictions,
      captainedFixtureId: "fixture-1",
      wager: { fixtureId: "fixture-1", stakePoints: 10 },
    });
  });

  it("preserves API error status and code for profile onboarding", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: { code: "PROFILE_NOT_FOUND", message: "Complete your profile to continue." } }),
    }));
    const user = { getIdToken: vi.fn().mockResolvedValue("firebase-token") } as unknown as User;

    await expect(api.profile(user)).rejects.toEqual(expect.objectContaining<ApiError>({
      name: "ApiError",
      status: 404,
      code: "PROFILE_NOT_FOUND",
      message: "Complete your profile to continue.",
    }));
  });

  it("sends personal and manager names when registering a profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: {} }) });
    vi.stubGlobal("fetch", fetchMock);
    const user = { getIdToken: vi.fn().mockResolvedValue("firebase-token") } as unknown as User;
    const input = { firstName: "Alex", lastName: "Smith", managerName: "The Gaffer", favoriteTeamId: "arsenal" };

    await api.registerProfile(user, input);

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body))).toEqual(input);
  });
});
