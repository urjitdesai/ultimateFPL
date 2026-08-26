import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { getCurrentGameweek } from "../gameweeks/gameweeks.service.js";
import { scorePrediction } from "./predictions.scoring.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";

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

export function predictionIsLocked(kickoffAt: Timestamp, now = Timestamp.now()) {
  return now.toMillis() >= kickoffAt.toMillis();
}

export function gameweekLockDeadline(startsAt: string | Date) {
  return new Date(startsAt).getTime() - 60 * 60 * 1000;
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

export async function saveGameweekPredictions(
  userId: string,
  gameweekId: string,
  input: z.infer<typeof predictionBatchSchema>,
) {
  const currentGameweek = await getCurrentGameweek();
  if (!isCurrentPredictionGameweek(gameweekId, currentGameweek?.id ?? null)) {
    throw Object.assign(new Error("Predictions are only open for the current gameweek."), {
      code: "PREDICTION_LOCKED",
      status: 409,
    });
  }

  const uniqueFixtureIds = new Set(input.predictions.map((prediction) => prediction.fixtureId));
  if (uniqueFixtureIds.size !== input.predictions.length) {
    throw Object.assign(new Error("Each fixture can appear only once."), { code: "INVALID_SCORE", status: 400 });
  }

  const fixtureRefs = input.predictions.map((prediction) => firestore.collection("fixtures").doc(prediction.fixtureId));
  const predictionRefs = input.predictions.map((prediction) => firestore.collection("predictions").doc(predictionId(userId, prediction.fixtureId)));
  await firestore.runTransaction(async (transaction) => {
    const user = await transaction.get(firestore.collection("users").doc(userId));
    const fixtures = await Promise.all(fixtureRefs.map((ref) => transaction.get(ref)));
    const existingPredictions = await Promise.all(predictionRefs.map((ref) => transaction.get(ref)));
    const userPredictions = await transaction.get(
      firestore.collection("predictions").where("userId", "==", userId),
    );
    if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });

    const existingGameweekPredictions = userPredictions.docs
      .filter((prediction) => prediction.data().gameweekId === gameweekId);
    const captainExists = input.captainedFixtureId == null
      || input.predictions.some((prediction) => prediction.fixtureId === input.captainedFixtureId)
      || existingGameweekPredictions.some((prediction) => prediction.data().fixtureId === input.captainedFixtureId);
    if (!captainExists) {
      throw Object.assign(new Error("Captain a fixture with a saved prediction."), { code: "INVALID_CAPTAIN", status: 400 });
    }

    const now = Timestamp.now();
    if (!isUserEligibleForGameweek(
      user.data()!.joinedGameweek,
      userJoinedAtMillis(user.data()!),
      currentGameweek!,
    )) {
      throw Object.assign(new Error(`Your scoring starts in Gameweek ${user.data()!.joinedGameweek}.`), {
        code: "USER_NOT_ELIGIBLE",
        status: 409,
      });
    }
    for (let index = 0; index < input.predictions.length; index += 1) {
      const requested = input.predictions[index]!;
      const fixture = fixtures[index]!;
      if (!fixture.exists || fixture.data()!.gameweekId !== gameweekId) {
        throw Object.assign(new Error("A fixture does not belong to this gameweek."), { code: "FIXTURE_NOT_FOUND", status: 404 });
      }
      if (currentGameweek?.seasonId !== fixture.data()!.seasonId) {
        throw Object.assign(new Error("This fixture is not in the current season."), { code: "FIXTURE_NOT_FOUND", status: 404 });
      }
      if (now.toMillis() >= gameweekLockDeadline(currentGameweek!.startsAt)) {
        throw Object.assign(new Error("Predictions lock one hour before the gameweek starts."), { code: "PREDICTION_LOCKED", status: 409 });
      }

      const reference = predictionRefs[index]!;
      transaction.set(reference, {
        userId,
        fixtureId: requested.fixtureId,
        seasonId: fixture.data()!.seasonId,
        gameweekId,
        predictedHomeScore: requested.predictedHomeScore,
        predictedAwayScore: requested.predictedAwayScore,
        submittedAt: existingPredictions[index]!.data()?.submittedAt ?? FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        lockedAt: null,
        awardedPoints: null,
        scoringReason: null,
        scoredAt: null,
        scoringRuleVersion: null,
        basePoints: null,
        isCaptain: requested.fixtureId === input.captainedFixtureId,
      }, { merge: true });
    }

    for (const prediction of existingGameweekPredictions) {
      if (input.predictions.some((requested) => requested.fixtureId === prediction.data().fixtureId)) continue;
      transaction.update(prediction.ref, {
        isCaptain: prediction.data().fixtureId === input.captainedFixtureId,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return getGameweekPredictions(userId, gameweekId);
}

export async function settleFixturePredictions(fixtureId: string) {
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
    const defaultBatch = firestore.batch();
    for (const user of missingUsers) {
      defaultBatch.create(firestore.collection("predictions").doc(predictionId(user.id, fixtureId)), {
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
    await defaultBatch.commit();
  }

  const allPredictions = missingUsers.length > 0
    ? await firestore.collection("predictions").where("fixtureId", "==", fixtureId).get()
    : predictions;
  if (allPredictions.empty) return;
  const batch = firestore.batch();
  const userIds = new Set<string>();
  for (const prediction of allPredictions.docs) {
    const data = prediction.data();
    if (!eligibleUserIds.has(data.userId)) continue;
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
  await Promise.all([...userIds].map((userId) => rebuildUserStats(userId, fixtureData.seasonId)));
}

async function rebuildUserStats(userId: string, seasonId: string) {
  const [snapshot, user, gameweeks] = await Promise.all([
    firestore.collection("predictions").where("userId", "==", userId).get(),
    firestore.collection("users").doc(userId).get(),
    firestore.collection("gameweeks").where("seasonId", "==", seasonId).get(),
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

  const totals = (predictions: typeof scored) => ({
    points: predictions.reduce((sum, prediction) => sum + Number(prediction.awardedPoints), 0),
    scoredFixtures: predictions.length,
    exactScores: predictions.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
    correctResults: predictions.filter((prediction) => ["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_RESULT"].includes(prediction.scoringReason)).length,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const seasonTotals = totals(scored);
  const batch = firestore.batch();
  batch.set(firestore.collection("userSeasonStats").doc(`${seasonId}_${userId}`), { userId, seasonId, ...seasonTotals });
  for (const [gameweekId, predictions] of byGameweek) {
    batch.set(firestore.collection("userGameweekStats").doc(`${gameweekId}_${userId}`), { userId, seasonId, gameweekId, ...totals(predictions) });
  }
  await batch.commit();
  const walletRef = firestore.collection("pointWallets").doc(userId);
  await firestore.runTransaction(async (transaction) => {
    const wallet = await transaction.get(walletRef);
    if (!wallet.exists) {
      transaction.create(walletRef, {
        userId,
        availablePoints: STARTING_TOTAL_POINTS + seasonTotals.points,
        reservedPoints: 0,
        predictionPoints: seasonTotals.points,
        predictionSeasonId: seasonId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }
    const previousPredictionPoints = Number(wallet.data()!.predictionPoints ?? 0);
    transaction.update(walletRef, {
      availablePoints: Number(wallet.data()!.availablePoints) + seasonTotals.points - previousPredictionPoints,
      predictionPoints: seasonTotals.points,
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
  const { settleFixtureWagers } = await import("../wagers/wagers.service.js");
  await Promise.all(fixtures.filter((fixture) => fixture.normalizedStatus === "COMPLETED")
    .flatMap((fixture) => [settleFixturePredictions(fixture.id), settleFixtureWagers(fixture.id)]));

  const predictionSnapshots = await Promise.all(fixtures.map((fixture) =>
    firestore.collection("predictions").doc(predictionId(userId, fixture.id)).get()));
  const predictions = new Map(predictionSnapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => [snapshot.data()!.fixtureId as string, serializePrediction(snapshot.data()!)]));
  const seasonId = fixtures[0]?.seasonId as string | undefined;
  if (seasonId) await rebuildUserStats(userId, seasonId);
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
    },
  };
}
