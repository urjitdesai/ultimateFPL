import type { User } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./api";

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
});
