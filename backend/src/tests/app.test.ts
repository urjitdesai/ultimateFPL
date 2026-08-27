import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../app.js";
import { assignGameweeks, selectSeasonByYear } from "../fixtures/fixtures.service.js";
import { decodeHtmlEntities } from "../utils/html.js";
import { scorePrediction } from "../predictions/predictions.scoring.js";
import { gameweekLockDeadline, gameweekSubmissionIsLocked } from "../gameweeks/gameweek-deadline.js";
import { isCurrentPredictionGameweek, isUserEligibleForGameweek } from "../predictions/predictions.service.js";
import { Timestamp } from "firebase-admin/firestore";
import { getGameweekStatus, selectJoinGameweek, type Gameweek } from "../gameweeks/gameweeks.service.js";
import { createdLeagueLimitReached, defaultLeagueRecords, generateInviteCode, getMembershipStartRound, normalizeInviteCode, privateLeagueMemberLimitReached, rankLeagueStandings, selectStandingsGameweeks } from "../leagues/leagues.service.js";
import { fixtureOutcome, settleWager, teamsOnCooldown } from "../wagers/wagers.service.js";
import { gameweekSubmissionSchema } from "../predictions/gameweek-submission.service.js";
import { validatePurgeTarget } from "../config/purge-safety.js";
import { createRateLimit } from "../middleware/rate-limits.js";

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

  it("doubles a captain prediction's earned points", () => {
    expect(scorePrediction({ predictedHome: 3, predictedAway: 1, actualHome: 3, actualAway: 1, isCaptain: true })).toMatchObject({ basePoints: 5, points: 10, reason: "EXACT_SCORE", ruleVersion: "2026.2" });
    expect(scorePrediction({ predictedHome: 2, predictedAway: 1, actualHome: 3, actualAway: 1, isCaptain: true })).toMatchObject({ basePoints: 2, points: 4, reason: "CORRECT_RESULT" });
    expect(scorePrediction({ predictedHome: 1, predictedAway: 1, actualHome: 3, actualAway: 1, isCaptain: true })).toMatchObject({ basePoints: 0, points: 0, reason: "INCORRECT" });
  });

  it("protects prediction reads and atomic gameweek submissions", async () => {
    const read = await request(app).get("/api/v1/gameweeks/gameweek-1/predictions/me");
    const write = await request(app).put("/api/v1/gameweeks/gameweek-1/submission").send({ predictions: [], wager: null });
    const legacyWrite = await request(app).put("/api/v1/gameweeks/gameweek-1/predictions").send({ predictions: [] });
    expect(read.status).toBe(401);
    expect(write.status).toBe(401);
    expect(legacyWrite.status).toBe(404);
  });

  it("requires captain and wager choices to reference submitted predictions", () => {
    const predictions = [{ fixtureId: "fixture-1", predictedHomeScore: 2, predictedAwayScore: 1 }];
    const valid = gameweekSubmissionSchema.safeParse({
      predictions,
      captainedFixtureId: "fixture-1",
      wager: { fixtureId: "fixture-1", selection: "AWAY_WIN", stakePoints: 20 },
    });
    expect(valid.success).toBe(true);
    if (valid.success) expect(valid.data.wager).toEqual({ fixtureId: "fixture-1", stakePoints: 20 });
    expect(gameweekSubmissionSchema.safeParse({
      predictions,
      captainedFixtureId: "fixture-2",
      wager: null,
    }).success).toBe(false);
    expect(gameweekSubmissionSchema.safeParse({
      predictions,
      captainedFixtureId: null,
      wager: { fixtureId: "fixture-2", stakePoints: 10 },
    }).success).toBe(false);
    expect(gameweekSubmissionSchema.safeParse({
      predictions,
      captainedFixtureId: null,
      wager: { fixtureId: "fixture-1", stakePoints: 21 },
    }).success).toBe(false);
  });

  it("locks the bundled prediction, captain, and wager submission at the gameweek deadline", () => {
    const startsAt = "2026-08-10T15:00:00.000Z";
    const deadline = Date.parse("2026-08-10T14:00:00.000Z");
    expect(gameweekLockDeadline(startsAt)).toBe(deadline);
    expect(gameweekSubmissionIsLocked(startsAt, deadline - 1)).toBe(false);
    expect(gameweekSubmissionIsLocked(startsAt, deadline)).toBe(true);
    expect(gameweekSubmissionIsLocked(startsAt, deadline + 1)).toBe(true);
  });

  it("returns a consistent 429 response when an API quota is exceeded", async () => {
    const limitedApp = express();
    limitedApp.get("/limited", createRateLimit({
      code: "TEST_RATE_LIMITED",
      limit: 1,
      message: "Wait before trying again.",
    }), (_req, res) => res.json({ data: true }));

    expect((await request(limitedApp).get("/limited")).status).toBe(200);
    const limited = await request(limitedApp).get("/limited");
    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({
      code: "TEST_RATE_LIMITED",
      message: "Wait before trying again.",
    });
  });

  it("opens predictions only for the current gameweek", () => {
    expect(isCurrentPredictionGameweek("gw-4", "gw-4")).toBe(true);
    expect(isCurrentPredictionGameweek("gw-5", "gw-4")).toBe(false);
    expect(isCurrentPredictionGameweek("gw-4", null)).toBe(false);
  });

  it("keeps a gameweek active until every fixture is settled", () => {
    const startsAt = new Date("2026-08-10T12:00:00Z");
    const now = new Date("2026-08-11T12:00:00Z");

    expect(getGameweekStatus(startsAt, ["COMPLETED", "LIVE"], now)).toBe("ACTIVE");
    expect(getGameweekStatus(startsAt, ["COMPLETED", "SCHEDULED"], now)).toBe("ACTIVE");
    expect(getGameweekStatus(startsAt, ["COMPLETED", "POSTPONED", "CANCELLED"], now)).toBe("COMPLETE");
  });

  it("does not activate a gameweek before its first kickoff", () => {
    expect(getGameweekStatus(
      new Date("2026-08-12T12:00:00Z"),
      ["SCHEDULED"],
      new Date("2026-08-11T12:00:00Z"),
    )).toBe("UPCOMING");
  });

  it("calculates league rank movement from the previous gameweek", () => {
    const base = { favoriteTeam: null, gameweekPoints: 0, exactScores: 0, previousExactScores: 0, correctResults: 0, previousCorrectResults: 0, scoringStartedGameweek: 1 };
    const standings = rankLeagueStandings([
      { ...base, userId: "alex", displayName: "Alex", points: 12, previousPoints: 5, joinedAt: 1 },
      { ...base, userId: "sam", displayName: "Sam", points: 10, previousPoints: 8, joinedAt: 2 },
    ]);
    expect(standings.find((entry) => entry.userId === "alex")).toMatchObject({ rank: 1, previousRank: 2, rankChange: 1 });
    expect(standings.find((entry) => entry.userId === "sam")).toMatchObject({ rank: 2, previousRank: 1, rankChange: -1 });
  });

  it("gives equal-point players the same competition rank", () => {
    const base = { favoriteTeam: null, gameweekPoints: 0, exactScores: 0, previousExactScores: 0, correctResults: 0, previousCorrectResults: 0, previousPoints: 20, scoringStartedGameweek: 1 };
    const standings = rankLeagueStandings([
      { ...base, userId: "alex", displayName: "Alex", points: 30, joinedAt: 1 },
      { ...base, userId: "sam", displayName: "Sam", points: 30, joinedAt: 2 },
      { ...base, userId: "jamie", displayName: "Jamie", points: 10, joinedAt: 3 },
    ]);
    expect(standings.map(({ userId, rank }) => ({ userId, rank }))).toEqual([
      { userId: "alex", rank: 1 },
      { userId: "sam", rank: 1 },
      { userId: "jamie", rank: 3 },
    ]);
  });

  it("protects league standings", async () => {
    const response = await request(app).get("/api/v1/leagues/league-1/standings");
    expect(response.status).toBe(401);
  });

  it("protects league member prediction history", async () => {
    const response = await request(app).get("/api/v1/leagues/league-1/members/user-2/predictions");
    expect(response.status).toBe(401);
  });

  it("normalizes shareable league keys", () => {
    expect(normalizeInviteCode(" abcd-2345 ")).toBe("ABCD2345");
    expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
  });

  it("protects league creation and joining", async () => {
    const [createResponse, joinResponse] = await Promise.all([
      request(app).post("/api/v1/leagues").send({ name: "Office League" }),
      request(app).post("/api/v1/leagues/join").send({ inviteCode: "ABCD2345" }),
    ]);
    expect(createResponse.status).toBe(401);
    expect(joinResponse.status).toBe(401);
  });

  it("uses the league joining gameweek as the scoring boundary", () => {
    const gameweeks = [
      { roundNumber: 1, startsAt: "2026-08-08T12:00:00.000Z", endsAt: "2026-08-10T20:00:00.000Z" },
      { roundNumber: 2, startsAt: "2026-08-15T12:00:00.000Z", endsAt: "2026-08-17T20:00:00.000Z" },
      { roundNumber: 3, startsAt: "2026-08-22T12:00:00.000Z", endsAt: "2026-08-24T20:00:00.000Z" },
    ];
    expect(getMembershipStartRound(3, null, gameweeks)).toBe(3);
    expect(getMembershipStartRound(undefined, Date.parse("2026-08-12T12:00:00.000Z"), gameweeks)).toBe(2);
    expect(getMembershipStartRound(2, Date.parse("2026-08-15T11:00:00.000Z"), gameweeks)).toBe(3);
  });

  it("builds standings only through the latest completed gameweek", () => {
    expect(selectStandingsGameweeks([
      { roundNumber: 1, status: "COMPLETE" },
      { roundNumber: 2, status: "COMPLETE" },
      { roundNumber: 3, status: "ACTIVE" },
      { roundNumber: 4, status: "UPCOMING" },
    ])).toEqual({ currentGameweek: 2, previousGameweek: 1 });
    expect(selectStandingsGameweeks([
      { roundNumber: 1, status: "ACTIVE" },
      { roundNumber: 2, status: "UPCOMING" },
    ])).toEqual({ currentGameweek: 0, previousGameweek: null });
  });

  it("protects wager reads and does not expose standalone wager mutations", async () => {
    const read = await request(app).get("/api/v1/gameweeks/gameweek-1/wager/me");
    const write = await request(app).put("/api/v1/gameweeks/gameweek-1/wager").send({ fixtureId: "fixture-1", stakePoints: 10 });
    const remove = await request(app).delete("/api/v1/gameweeks/gameweek-1/wager");
    expect(read.status).toBe(401);
    expect(write.status).toBe(404);
    expect(remove.status).toBe(404);
  });

  it("settles outcome wagers at double return or a lost stake", () => {
    expect(fixtureOutcome(2, 1)).toBe("HOME_WIN");
    expect(fixtureOutcome(1, 1)).toBe("DRAW");
    expect(settleWager("AWAY_WIN", 20, 0, 2)).toEqual({ status: "WON", returnPoints: 40 });
    expect(settleWager("DRAW", 12, 1, 0)).toEqual({ status: "LOST", returnPoints: 0 });
  });

  it("blocks both wagered teams for the next three gameweeks", () => {
    const history = [{ roundNumber: 2, homeTeamId: "arsenal", awayTeamId: "chelsea" }];
    expect([...teamsOnCooldown(history, 3)].sort()).toEqual(["arsenal", "chelsea"]);
    expect([...teamsOnCooldown(history, 5)].sort()).toEqual(["arsenal", "chelsea"]);
    expect([...teamsOnCooldown(history, 6)]).toEqual([]);
  });

  it("places users in the cohort for their first scoring-eligible gameweek", () => {
    const gameweeks = [
      { id: "gw-2", seasonId: "season-1", roundNumber: 2, startsAt: "2026-08-15T12:00:00.000Z", endsAt: "2026-08-17T20:00:00.000Z", fixtureCount: 10, status: "UPCOMING" },
      { id: "gw-3", seasonId: "season-1", roundNumber: 3, startsAt: "2026-08-22T12:00:00.000Z", endsAt: "2026-08-24T20:00:00.000Z", fixtureCount: 10, status: "UPCOMING" },
    ] satisfies Gameweek[];
    expect(selectJoinGameweek(gameweeks, Date.parse("2026-08-15T10:59:59.000Z"))?.roundNumber).toBe(2);
    expect(selectJoinGameweek(gameweeks, Date.parse("2026-08-15T11:00:00.000Z"))?.roundNumber).toBe(3);
  });

  it("creates deterministic overall and team supporter league records", () => {
    expect(defaultLeagueRecords("season-1", [
      { id: "arsenal", name: "Arsenal", shortName: "ARS", logoUrl: "" },
      { id: "chelsea", name: "Chelsea", shortName: "CHE", logoUrl: "" },
    ], [1, 2])).toEqual([
      { id: "season-1_overall", name: "Overall", favoriteTeamId: null, roundNumber: null },
      { id: "season-1_team_arsenal", name: "Arsenal Supporters", favoriteTeamId: "arsenal", roundNumber: null },
      { id: "season-1_team_chelsea", name: "Chelsea Supporters", favoriteTeamId: "chelsea", roundNumber: null },
      { id: "season-1_gameweek_1", name: "Gameweek 1", favoriteTeamId: null, roundNumber: 1 },
      { id: "season-1_gameweek_2", name: "Gameweek 2", favoriteTeamId: null, roundNumber: 2 },
    ]);
  });

  it("enforces created-league and private-league member quotas at their boundaries", () => {
    expect(createdLeagueLimitReached(49, 50)).toBe(false);
    expect(createdLeagueLimitReached(50, 50)).toBe(true);
    expect(privateLeagueMemberLimitReached(99, 100)).toBe(false);
    expect(privateLeagueMemberLimitReached(100, 100)).toBe(true);
  });

  it("allows purges only for an explicitly allowlisted and confirmed non-production project", () => {
    const allowedProjectIds = new Set(["ultimatefpl-development"]);
    const base = {
      allowedProjectIds,
      confirmationToken: "PURGE-ultimatefpl-development",
      configuredProjectId: "ultimatefpl-development",
      confirmedProjectId: "ultimatefpl-development",
      nodeEnvironment: "development",
      protectedProjectIds: new Set(["ultimatefpl-production"]),
    };
    expect(validatePurgeTarget(base)).toBe("ultimatefpl-development");
    expect(() => validatePurgeTarget({ ...base, nodeEnvironment: "production" })).toThrow(/NODE_ENV=production/);
    expect(() => validatePurgeTarget({ ...base, configuredProjectId: "ultimatefpl-production", confirmedProjectId: "ultimatefpl-production" })).toThrow(/protected/);
    expect(() => validatePurgeTarget({ ...base, configuredProjectId: "unknown", confirmedProjectId: "unknown" })).toThrow(/not in PURGE_ALLOWED_PROJECT_IDS/);
    expect(() => validatePurgeTarget({ ...base, confirmedProjectId: "wrong-project" })).toThrow(/Confirm the exact target/);
    expect(() => validatePurgeTarget({ ...base, confirmationToken: "" })).toThrow(/Explicit confirmation is required/);
  });

  it("does not score gameweeks from before registration or after their deadline", () => {
    const gameweek = { roundNumber: 2, startsAt: "2026-08-15T12:00:00.000Z" };
    expect(isUserEligibleForGameweek(2, Date.parse("2026-08-15T10:59:59.000Z"), gameweek)).toBe(true);
    expect(isUserEligibleForGameweek(2, Date.parse("2026-08-15T11:00:00.000Z"), gameweek)).toBe(false);
    expect(isUserEligibleForGameweek(3, Date.parse("2026-08-01T10:00:00.000Z"), gameweek)).toBe(false);
  });

});
