import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { gameweekLockDeadline } from "../gameweeks/gameweek-deadline.js";
import { getCurrentGameweek } from "../gameweeks/gameweeks.service.js";
import { scorePrediction } from "./predictions.scoring.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import { env } from "../config/env.js";

export const predictionBatchSchema = z.object({
  predictions: z.array(z.object({
    fixtureId: z.string().min(1),
    predictedHomeScore: z.number().int().min(0).max(20),
    predictedAwayScore: z.number().int().min(0).max(20),
  })).min(1).max(20),
  captainedFixtureId: z.string().min(1).nullable().optional().default(null),
});

function predictionId(userId: string, fixtureId: string) {
  return `${userId}_${fixtureId}`;
}

export function isCurrentPredictionGameweek(requestedGameweekId: string, currentGameweekId: string | null) {
  return requestedGameweekId === currentGameweekId;
}

export function isUserEligibleForGameweek(
  joinedGameweek: unknown,
  joinedAtMillis: number | null,
  gameweek: { roundNumber: number; startsAt: string | Date },
) {
  const joinedRound = typeof joinedGameweek === "number" && Number.isInteger(joinedGameweek)
    ? joinedGameweek
    : 1;
  if (gameweek.roundNumber < joinedRound) return false;
  return joinedAtMillis == null || joinedAtMillis < gameweekLockDeadline(gameweek.startsAt);
}

function userJoinedAtMillis(data: FirebaseFirestore.DocumentData) {
  const value = data.eligibleFromAt ?? data.createdAt;
  return value instanceof Timestamp ? value.toMillis() : null;
}

function serializePrediction(data: FirebaseFirestore.DocumentData) {
  return {
    predictedHomeScore: data.predictedHomeScore as number,
    predictedAwayScore: data.predictedAwayScore as number,
    awardedPoints: data.awardedPoints == null ? null : Number(data.awardedPoints),
    scoringReason: (data.scoringReason as string | null) ?? null,
    basePoints: data.basePoints == null ? null : Number(data.basePoints),
    isCaptain: data.isCaptain === true,
    submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : null,
  };
}

function chunks<T>(values: T[], size = env.SCORING_BATCH_SIZE) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size));
}

export async function settleFixturePredictions(
  fixtureId: string,
  options: { rebuildStats?: boolean } = {},
) {
  const fixture = await firestore.collection("fixtures").doc(fixtureId).get();
  const fixtureData = fixture.data();
  if (!fixture.exists || fixtureData?.normalizedStatus !== "COMPLETED"
    || fixtureData.homeScore == null || fixtureData.awayScore == null) return;

  const gameweek = await firestore.collection("gameweeks").doc(fixtureData.gameweekId).get();
  if (!gameweek.exists) return;
  const gameweekData = gameweek.data()!;
  const eligibilityGameweek = {
    roundNumber: Number(gameweekData.roundNumber),
    startsAt: (gameweekData.startsAt as Timestamp).toDate(),
  };

  const [predictions, users] = await Promise.all([
    firestore.collection("predictions").where("fixtureId", "==", fixtureId).get(),
    firestore.collection("users").get(),
  ]);
  const existingUserIds = new Set(predictions.docs.map((prediction) => prediction.data().userId as string));
  const eligibleUsers = users.docs.filter((user) => isUserEligibleForGameweek(
    user.data().joinedGameweek,
    userJoinedAtMillis(user.data()),
    eligibilityGameweek,
  ));
  const eligibleUserIds = new Set(eligibleUsers.map((user) => user.id));
  const missingUsers = eligibleUsers.filter((user) => !existingUserIds.has(user.id));
  if (missingUsers.length > 0) {
    for (const usersChunk of chunks(missingUsers)) {
      const chunkBatch = firestore.batch();
      for (const user of usersChunk) {
        chunkBatch.create(firestore.collection("predictions").doc(predictionId(user.id, fixtureId)), {
          userId: user.id,
          fixtureId,
          seasonId: fixtureData.seasonId,
          gameweekId: fixtureData.gameweekId,
          predictedHomeScore: 0,
          predictedAwayScore: 0,
          submittedAt: null,
          updatedAt: null,
          lockedAt: fixtureData.kickoffAt,
          awardedPoints: null,
          scoringReason: null,
          scoredAt: null,
          scoringRuleVersion: null,
          basePoints: null,
          isCaptain: false,
          isDefault: true,
        });
      }
      await chunkBatch.commit();
    }
  }

  const allPredictions = missingUsers.length > 0
    ? await firestore.collection("predictions").where("fixtureId", "==", fixtureId).get()
    : predictions;
  if (allPredictions.empty) return new Set<string>();
  const userIds = new Set<string>();
  const eligiblePredictions = allPredictions.docs.filter((prediction) =>
    eligibleUserIds.has(prediction.data().userId));
  for (const predictionChunk of chunks(eligiblePredictions)) {
    const batch = firestore.batch();
    for (const prediction of predictionChunk) {
      const data = prediction.data();
      const result = scorePrediction({
        predictedHome: data.predictedHomeScore,
        predictedAway: data.predictedAwayScore,
        actualHome: fixtureData.homeScore,
        actualAway: fixtureData.awayScore,
        isCaptain: data.isCaptain === true,
      });
      batch.update(prediction.ref, {
        awardedPoints: result.points,
        basePoints: result.basePoints,
        scoringReason: result.reason,
        scoringRuleVersion: result.ruleVersion,
        lockedAt: fixtureData.kickoffAt,
        scoredAt: FieldValue.serverTimestamp(),
      });
      userIds.add(data.userId);
    }
    await batch.commit();
  }
  if (options.rebuildStats !== false) {
    for (const userId of userIds) await rebuildUserStats(userId, fixtureData.seasonId);
  }
  return userIds;
}

export async function rebuildUserStats(userId: string, seasonId: string) {
  const [snapshot, user, gameweeks, wagers] = await Promise.all([
    firestore.collection("predictions").where("userId", "==", userId).get(),
    firestore.collection("users").doc(userId).get(),
    firestore.collection("gameweeks").where("seasonId", "==", seasonId).get(),
    firestore.collection("wagers").where("userId", "==", userId).get(),
  ]);
  if (!user.exists) return;
  const gameweekById = new Map(gameweeks.docs.map((document) => {
    const data = document.data();
    return [document.id, {
      roundNumber: Number(data.roundNumber),
      startsAt: (data.startsAt as Timestamp).toDate(),
    }];
  }));
  const scored = snapshot.docs.map((doc) => doc.data())
    .filter((prediction) => {
      const gameweek = gameweekById.get(prediction.gameweekId);
      return prediction.seasonId === seasonId
        && prediction.awardedPoints != null
        && gameweek != null
        && isUserEligibleForGameweek(user.data()!.joinedGameweek, userJoinedAtMillis(user.data()!), gameweek);
    });
  const byGameweek = new Map<string, typeof scored>();
  for (const prediction of scored) {
    byGameweek.set(prediction.gameweekId, [...(byGameweek.get(prediction.gameweekId) ?? []), prediction]);
  }

  const settledWagers = wagers.docs.map((document) => document.data())
    .filter((wager) => wager.seasonId === seasonId && ["WON", "LOST"].includes(wager.status));
  const wagerPointsForGameweek = (gameweekId: string) => settledWagers
    .filter((wager) => wager.gameweekId === gameweekId)
    .reduce((sum, wager) => sum + Number(wager.returnPoints ?? 0) - Number(wager.stakePoints), 0);
  const totals = (predictions: typeof scored, gameweekId?: string) => {
    const predictionPoints = predictions.reduce((sum, prediction) => sum + Number(prediction.awardedPoints), 0);
    const wagerPoints = gameweekId == null
      ? settledWagers.reduce((sum, wager) => sum + Number(wager.returnPoints ?? 0) - Number(wager.stakePoints), 0)
      : wagerPointsForGameweek(gameweekId);
    return {
      points: predictionPoints,
      predictionPoints,
      wagerPoints,
      totalPoints: predictionPoints + wagerPoints,
      scoredFixtures: predictions.length,
      exactScores: predictions.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      correctResults: predictions.filter((prediction) => ["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_RESULT"].includes(prediction.scoringReason)).length,
      updatedAt: FieldValue.serverTimestamp(),
    };
  };

  const seasonTotals = totals(scored);
  const batch = firestore.batch();
  batch.set(firestore.collection("userSeasonStats").doc(`${seasonId}_${userId}`), { userId, seasonId, ...seasonTotals });
  for (const [gameweekId, predictions] of byGameweek) {
    batch.set(firestore.collection("userGameweekStats").doc(`${gameweekId}_${userId}`), { userId, seasonId, gameweekId, ...totals(predictions, gameweekId) });
  }
  await batch.commit();
  const walletRef = firestore.collection("pointWallets").doc(userId);
  await firestore.runTransaction(async (transaction) => {
    const wallet = await transaction.get(walletRef);
    if (!wallet.exists) {
      transaction.create(walletRef, {
        userId,
        availablePoints: STARTING_TOTAL_POINTS + seasonTotals.totalPoints,
        reservedPoints: 0,
        predictionPoints: seasonTotals.points,
        settledWagerPoints: seasonTotals.wagerPoints,
        predictionSeasonId: seasonId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    transaction.update(walletRef, {
      availablePoints: STARTING_TOTAL_POINTS + seasonTotals.totalPoints - Number(wallet.data()!.reservedPoints ?? 0),
      predictionPoints: seasonTotals.points,
      settledWagerPoints: seasonTotals.wagerPoints,
      predictionSeasonId: seasonId,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export async function getGameweekPredictions(userId: string, gameweekId: string) {
  const [fixtures, currentGameweek, requestedGameweek, user] = await Promise.all([
    getFixturesForGameweek(gameweekId),
    getCurrentGameweek(),
    firestore.collection("gameweeks").doc(gameweekId).get(),
    firestore.collection("users").doc(userId).get(),
  ]);
  if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });
  const requestedData = requestedGameweek.data();
  const eligible = Boolean(requestedGameweek.exists && requestedData && isUserEligibleForGameweek(
    user.data()!.joinedGameweek,
    userJoinedAtMillis(user.data()!),
    { roundNumber: Number(requestedData.roundNumber), startsAt: (requestedData.startsAt as Timestamp).toDate() },
  ));
  const deadline = currentGameweek?.id === gameweekId ? gameweekLockDeadline(currentGameweek.startsAt) : 0;
  const predictionsOpen = eligible && isCurrentPredictionGameweek(gameweekId, currentGameweek?.id ?? null) && Date.now() < deadline;
  if (env.SCORING_MODE === "request_driven") {
    const { settleFixtureWagers } = await import("../wagers/wagers.service.js");
    for (const fixture of fixtures.filter((candidate) => candidate.normalizedStatus === "COMPLETED")) {
      await settleFixturePredictions(fixture.id);
      await settleFixtureWagers(fixture.id);
    }
  }

  const predictionSnapshots = await Promise.all(fixtures.map((fixture) =>
    firestore.collection("predictions").doc(predictionId(userId, fixture.id)).get()));
  const predictions = new Map(predictionSnapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => [snapshot.data()!.fixtureId as string, serializePrediction(snapshot.data()!)]));
  const seasonId = fixtures[0]?.seasonId as string | undefined;
  if (seasonId && env.SCORING_MODE === "request_driven") await rebuildUserStats(userId, seasonId);
  const [seasonStats, gameweekStats, wallet, wager] = await Promise.all([
    seasonId ? firestore.collection("userSeasonStats").doc(`${seasonId}_${userId}`).get() : null,
    firestore.collection("userGameweekStats").doc(`${gameweekId}_${userId}`).get(),
    firestore.collection("pointWallets").doc(userId).get(),
    firestore.collection("wagers").doc(`${userId}_${gameweekId}`).get(),
  ]);
  const wagerPoints = wager.exists
    ? Number(wager.data()!.returnPoints ?? 0) - Number(wager.data()!.stakePoints)
    : 0;
  return {
    fixtures: fixtures.map((fixture) => ({
      ...fixture,
      prediction: predictions.get(fixture.id) ?? null,
      predictionLocked: !predictionsOpen,
      predictionLockReason: !eligible ? "NOT_ELIGIBLE" : !predictionsOpen ? "GAMEWEEK_DEADLINE" : null,
    })),
    captainedFixtureId: [...predictions.entries()].find(([, prediction]) => prediction.isCaptain)?.[0] ?? null,
    predictionsOpen,
    eligibility: {
      eligible,
      startsGameweek: Number(user.data()!.joinedGameweek ?? 1),
    },
    summary: {
      totalPoints: wallet.exists
        ? Number(wallet.data()!.availablePoints)
        : STARTING_TOTAL_POINTS + Number(seasonStats?.data()?.points ?? 0),
      gameweekPoints: eligible ? Number(gameweekStats.data()?.points ?? 0) + wagerPoints : 0,
      wagerPoints: eligible ? wagerPoints : 0,
      submittedCount: eligible ? predictions.size : 0,
      fixtureCount: fixtures.length,
      pointsUpdatedAt: gameweekStats.data()?.updatedAt instanceof Timestamp
        ? gameweekStats.data()!.updatedAt.toDate().toISOString()
        : null,
    },
  };
}
