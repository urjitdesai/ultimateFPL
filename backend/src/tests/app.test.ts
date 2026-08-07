import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { getDefaultLeagues } from "../leagues/leagues.service.js";
import { assignGameweeks, selectSeasonByYear } from "../fixtures/fixtures.service.js";
import { decodeHtmlEntities } from "../utils/html.js";
import { scorePrediction } from "../predictions/predictions.scoring.js";
import { predictionIsLocked } from "../predictions/predictions.service.js";
import { Timestamp } from "firebase-admin/firestore";

describe("foundation API", () => {
  it("reports health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("returns the text-only team catalog", async () => {
    const response = await request(app).get("/api/v1/teams");
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(20);
    expect(response.body.data).toContainEqual(expect.objectContaining({ name: "Arsenal" }));
  });

  it("protects profile registration", async () => {
    const response = await request(app).post("/api/v1/auth/register-profile").send({ displayName: "Alex", favoriteTeamId: "arsenal" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("creates all deterministic default leagues", () => {
    expect(getDefaultLeagues("season-1", { id: "arsenal", name: "Arsenal", shortName: "ARS", logoUrl: "/team-logos/arsenal.png" }, 4)).toEqual([
      { id: "season-1_overall", name: "Overall", type: "OVERALL" },
      { id: "season-1_team_arsenal", name: "Arsenal Supporters", type: "TEAM_DEFAULT", favoriteTeamId: "arsenal" },
      { id: "season-1_gameweek_4", name: "Gameweek 4", type: "GAMEWEEK_DEFAULT", roundNumber: 4 }
    ]);
  });

  it("derives missing Premier League gameweeks from fixture-date clusters", () => {
    const base = {
      status: "incomplete",
      round_id: 1,
      season: { season_id: 1, year: 20262027 },
      home_team: { team_id: 1, team_name: "Home" },
      away_team: { team_id: 2, team_name: "Away" },
    };
    const result = assignGameweeks([
      { ...base, match_id: 1, match_date: "2026-08-21 19:00:00", date_unix: 1, game_week: null },
      { ...base, match_id: 2, match_date: "2026-08-22 15:00:00", date_unix: 2, game_week: null },
      { ...base, match_id: 3, match_date: "2026-08-29 15:00:00", date_unix: 3, game_week: null },
      { ...base, match_id: 4, match_date: "2026-10-17 15:00:00", date_unix: 4, game_week: 7 },
    ]);
    expect(result.map((match) => match.resolvedGameweek)).toEqual([1, 1, 2, 7]);
  });

  it("selects only the configured Premier League season year", () => {
    const seasons = [
      { season_id: 10, year: 20252026 },
      { season_id: 11, year: 20262027 },
      { season_id: 12, year: 20272028 },
    ];

    expect(selectSeasonByYear(seasons, 20262027)).toEqual({
      season_id: 11,
      year: 20262027,
    });
    expect(() => selectSeasonByYear(seasons, 20302031)).toThrow(
      "The Premier League 20302031 season was not returned by the provider.",
    );
  });

  it("decodes provider team names for display", () => {
    expect(decodeHtmlEntities("Brighton &amp; Hove Albion")).toBe("Brighton & Hove Albion");
    expect(decodeHtmlEntities("A&#39; Team &#x26; Co")).toBe("A' Team & Co");
  });

  it("scores predictions using exact-score precedence", () => {
    expect(scorePrediction({ predictedHome: 3, predictedAway: 1, actualHome: 3, actualAway: 1 })).toMatchObject({ points: 5, reason: "EXACT_SCORE" });
    expect(scorePrediction({ predictedHome: 2, predictedAway: 0, actualHome: 3, actualAway: 1 })).toMatchObject({ points: 3, reason: "CORRECT_GOAL_DIFFERENCE" });
    expect(scorePrediction({ predictedHome: 2, predictedAway: 1, actualHome: 3, actualAway: 1 })).toMatchObject({ points: 2, reason: "CORRECT_RESULT" });
    expect(scorePrediction({ predictedHome: 1, predictedAway: 1, actualHome: 3, actualAway: 1 })).toMatchObject({ points: 0, reason: "INCORRECT" });
  });

  it("awards three points for the correct non-exact draw", () => {
    expect(scorePrediction({ predictedHome: 0, predictedAway: 0, actualHome: 1, actualAway: 1 })).toMatchObject({ points: 3, reason: "CORRECT_GOAL_DIFFERENCE" });
  });

  it("protects prediction reads and writes", async () => {
    const read = await request(app).get("/api/v1/gameweeks/gameweek-1/predictions/me");
    const write = await request(app).put("/api/v1/gameweeks/gameweek-1/predictions").send({ predictions: [] });
    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
  });

  it("locks a prediction exactly at kickoff", () => {
    const kickoff = Timestamp.fromMillis(10_000);
    expect(predictionIsLocked(kickoff, Timestamp.fromMillis(9_999))).toBe(false);
    expect(predictionIsLocked(kickoff, Timestamp.fromMillis(10_000))).toBe(true);
  });
});
