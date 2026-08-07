import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { scorePrediction } from "./predictions.scoring.js";

export const predictionBatchSchema = z.object({
  predictions: z.array(z.object({
    fixtureId: z.string().min(1),
    predictedHomeScore: z.number().int().min(0).max(20),
    predictedAwayScore: z.number().int().min(0).max(20),
  })).min(1).max(20),
});

function predictionId(userId: string, fixtureId: string) {
  return `${userId}_${fixtureId}`;
}

export function predictionIsLocked(kickoffAt: Timestamp, now = Timestamp.now()) {
  return now.toMillis() >= kickoffAt.toMillis();
}

function serializePrediction(data: FirebaseFirestore.DocumentData) {
  return {
    predictedHomeScore: data.predictedHomeScore as number,
    predictedAwayScore: data.predictedAwayScore as number,
    awardedPoints: data.awardedPoints == null ? null : Number(data.awardedPoints),
    scoringReason: (data.scoringReason as string | null) ?? null,
    submittedAt: data.submittedAt instanceof Timestamp ? data.submittedAt.toDate().toISOString() : null,
    updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : null,
  };
}

export async function saveGameweekPredictions(
  userId: string,
  gameweekId: string,
  input: z.infer<typeof predictionBatchSchema>,
) {
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
    if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });

    const now = Timestamp.now();
    for (let index = 0; index < input.predictions.length; index += 1) {
      const requested = input.predictions[index]!;
      const fixture = fixtures[index]!;
      if (!fixture.exists || fixture.data()!.gameweekId !== gameweekId) {
        throw Object.assign(new Error("A fixture does not belong to this gameweek."), { code: "FIXTURE_NOT_FOUND", status: 404 });
      }
      if (user.data()!.activeSeasonId !== fixture.data()!.seasonId) {
        throw Object.assign(new Error("This fixture is not in your active season."), { code: "FIXTURE_NOT_FOUND", status: 404 });
      }
      if (predictionIsLocked(fixture.data()!.kickoffAt as Timestamp, now)) {
        throw Object.assign(new Error("Predictions lock when each fixture kicks off."), { code: "PREDICTION_LOCKED", status: 409 });
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
      }, { merge: true });
    }
  });

  return getGameweekPredictions(userId, gameweekId);
}

export async function settleFixturePredictions(fixtureId: string) {
  const fixture = await firestore.collection("fixtures").doc(fixtureId).get();
  const fixtureData = fixture.data();
  if (!fixture.exists || fixtureData?.normalizedStatus !== "COMPLETED"
    || fixtureData.homeScore == null || fixtureData.awayScore == null) return;

  const predictions = await firestore.collection("predictions").where("fixtureId", "==", fixtureId).get();
  if (predictions.empty) return;
  const batch = firestore.batch();
  const userIds = new Set<string>();
  for (const prediction of predictions.docs) {
    const data = prediction.data();
    const result = scorePrediction({
      predictedHome: data.predictedHomeScore,
      predictedAway: data.predictedAwayScore,
      actualHome: fixtureData.homeScore,
      actualAway: fixtureData.awayScore,
    });
    batch.update(prediction.ref, {
      awardedPoints: result.points,
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
  const snapshot = await firestore.collection("predictions").where("userId", "==", userId).get();
  const scored = snapshot.docs.map((doc) => doc.data())
    .filter((prediction) => prediction.seasonId === seasonId && prediction.awardedPoints != null);
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

  const batch = firestore.batch();
  batch.set(firestore.collection("userSeasonStats").doc(`${seasonId}_${userId}`), { userId, seasonId, ...totals(scored) });
  for (const [gameweekId, predictions] of byGameweek) {
    batch.set(firestore.collection("userGameweekStats").doc(`${gameweekId}_${userId}`), { userId, seasonId, gameweekId, ...totals(predictions) });
  }
  await batch.commit();
}

export async function getGameweekPredictions(userId: string, gameweekId: string) {
  const fixtures = await getFixturesForGameweek(gameweekId);
  await Promise.all(fixtures.filter((fixture) => fixture.normalizedStatus === "COMPLETED")
    .map((fixture) => settleFixturePredictions(fixture.id)));

  const predictionSnapshots = await Promise.all(fixtures.map((fixture) =>
    firestore.collection("predictions").doc(predictionId(userId, fixture.id)).get()));
  const predictions = new Map(predictionSnapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => [snapshot.data()!.fixtureId as string, serializePrediction(snapshot.data()!)]));
  const seasonId = fixtures[0]?.seasonId as string | undefined;
  const [seasonStats, gameweekStats] = await Promise.all([
    seasonId ? firestore.collection("userSeasonStats").doc(`${seasonId}_${userId}`).get() : null,
    firestore.collection("userGameweekStats").doc(`${gameweekId}_${userId}`).get(),
  ]);
  const now = Date.now();

  return {
    fixtures: fixtures.map((fixture) => ({
      ...fixture,
      prediction: predictions.get(fixture.id) ?? null,
      predictionLocked: now >= new Date(fixture.kickoffAt).getTime(),
    })),
    summary: {
      totalPoints: Number(seasonStats?.data()?.points ?? 0),
      gameweekPoints: Number(gameweekStats.data()?.points ?? 0),
      submittedCount: predictions.size,
      fixtureCount: fixtures.length,
    },
  };
}
