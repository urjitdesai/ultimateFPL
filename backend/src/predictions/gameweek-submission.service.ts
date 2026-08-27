import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getCurrentGameweek } from "../gameweeks/gameweeks.service.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import {
  fixtureOutcome,
  getGameweekWager,
  MAX_WAGER_POINTS,
  teamsOnCooldown,
} from "../wagers/wagers.service.js";
import {
  gameweekLockDeadline,
  getGameweekPredictions,
  isCurrentPredictionGameweek,
  isUserEligibleForGameweek,
  predictionBatchSchema,
} from "./predictions.service.js";

const wagerSubmissionSchema = z.object({
  fixtureId: z.string().min(1),
  stakePoints: z.number().int().min(1).max(MAX_WAGER_POINTS),
});

export const gameweekSubmissionSchema = predictionBatchSchema.extend({
  wager: wagerSubmissionSchema.nullable(),
}).superRefine((input, context) => {
  const fixtureIds = new Set(input.predictions.map((prediction) => prediction.fixtureId));
  if (input.captainedFixtureId != null && !fixtureIds.has(input.captainedFixtureId)) {
    context.addIssue({
      code: "custom",
      path: ["captainedFixtureId"],
      message: "The captain must be one of the submitted predictions.",
    });
  }
  if (input.wager != null && !fixtureIds.has(input.wager.fixtureId)) {
    context.addIssue({
      code: "custom",
      path: ["wager", "fixtureId"],
      message: "The wager must be on one of the submitted predictions.",
    });
  }
});

function predictionId(userId: string, fixtureId: string) {
  return `${userId}_${fixtureId}`;
}

function wagerId(userId: string, gameweekId: string) {
  return `${userId}_${gameweekId}`;
}

function userJoinedAtMillis(data: FirebaseFirestore.DocumentData) {
  const value = data.eligibleFromAt ?? data.createdAt;
  return value instanceof Timestamp ? value.toMillis() : null;
}

export async function saveGameweekSubmission(
  userId: string,
  gameweekId: string,
  input: z.infer<typeof gameweekSubmissionSchema>,
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
    throw Object.assign(new Error("Each fixture can appear only once."), {
      code: "INVALID_SCORE",
      status: 400,
    });
  }

  const userRef = firestore.collection("users").doc(userId);
  const gameweekRef = firestore.collection("gameweeks").doc(gameweekId);
  const walletRef = firestore.collection("pointWallets").doc(userId);
  const wagerRef = firestore.collection("wagers").doc(wagerId(userId, gameweekId));
  const predictionRefs = input.predictions.map((prediction) =>
    firestore.collection("predictions").doc(predictionId(userId, prediction.fixtureId)));
  const gameweekFixturesQuery = firestore.collection("fixtures").where("gameweekId", "==", gameweekId);
  const wagerHistoryQuery = firestore.collection("wagers").where("userId", "==", userId);

  await firestore.runTransaction(async (transaction) => {
    const [user, gameweek, wallet, existingWager, wagerHistory, gameweekFixtures] = await Promise.all([
      transaction.get(userRef),
      transaction.get(gameweekRef),
      transaction.get(walletRef),
      transaction.get(wagerRef),
      transaction.get(wagerHistoryQuery),
      transaction.get(gameweekFixturesQuery),
    ]);
    const existingPredictions = await Promise.all(
      predictionRefs.map((reference) => transaction.get(reference)),
    );

    if (!user.exists) {
      throw Object.assign(new Error("Complete your profile first."), {
        code: "PROFILE_REQUIRED",
        status: 409,
      });
    }
    if (!gameweek.exists || currentGameweek == null) {
      throw Object.assign(new Error("This gameweek is no longer available."), {
        code: "GAMEWEEK_NOT_FOUND",
        status: 404,
      });
    }
    const fixtureById = new Map(gameweekFixtures.docs.map((fixture) => [fixture.id, fixture]));
    if (gameweekFixtures.empty || uniqueFixtureIds.size !== fixtureById.size
      || [...uniqueFixtureIds].some((fixtureId) => !fixtureById.has(fixtureId))) {
      throw Object.assign(new Error("Submit one prediction for every fixture in this gameweek."), {
        code: "INCOMPLETE_PREDICTIONS",
        status: 400,
      });
    }
    const fixtures = input.predictions.map((prediction) => fixtureById.get(prediction.fixtureId)!);
    if (!isUserEligibleForGameweek(
      user.data()!.joinedGameweek,
      userJoinedAtMillis(user.data()!),
      currentGameweek,
    )) {
      throw Object.assign(new Error(`Your scoring starts in Gameweek ${user.data()!.joinedGameweek}.`), {
        code: "USER_NOT_ELIGIBLE",
        status: 409,
      });
    }

    const now = Timestamp.now();
    if (now.toMillis() >= gameweekLockDeadline(currentGameweek.startsAt)) {
      throw Object.assign(new Error("Predictions lock one hour before the gameweek starts."), {
        code: "PREDICTION_LOCKED",
        status: 409,
      });
    }

    for (let index = 0; index < input.predictions.length; index += 1) {
      const requested = input.predictions[index]!;
      const fixture = fixtures[index]!;
      if (!fixture.exists || fixture.data()!.gameweekId !== gameweekId
        || fixture.data()!.seasonId !== currentGameweek.seasonId) {
        throw Object.assign(new Error("A fixture does not belong to this gameweek."), {
          code: "FIXTURE_NOT_FOUND",
          status: 404,
        });
      }

      transaction.set(predictionRefs[index]!, {
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

    if (existingWager.exists && existingWager.data()!.status !== "OPEN") {
      throw Object.assign(new Error("This wager has already been settled."), {
        code: "WAGER_SETTLED",
        status: 409,
      });
    }

    const previousStake = existingWager.exists
      ? Number(existingWager.data()!.stakePoints)
      : 0;
    const nextStake = input.wager?.stakePoints ?? 0;
    const stakeDifference = nextStake - previousStake;
    const availablePoints = wallet.exists
      ? Number(wallet.data()!.availablePoints)
      : STARTING_TOTAL_POINTS;
    const reservedPoints = wallet.exists
      ? Number(wallet.data()!.reservedPoints ?? 0)
      : 0;

    if (stakeDifference > availablePoints) {
      throw Object.assign(new Error("You do not have enough points to place this wager."), {
        code: "INSUFFICIENT_WAGER_POINTS",
        status: 409,
      });
    }

    if (input.wager == null) {
      if (existingWager.exists) transaction.delete(wagerRef);
    } else {
      const wagerPredictionIndex = input.predictions.findIndex(
        (prediction) => prediction.fixtureId === input.wager!.fixtureId,
      );
      const wagerPrediction = input.predictions[wagerPredictionIndex]!;
      const wagerFixture = fixtures[wagerPredictionIndex]!;
      const fixtureData = wagerFixture.data()!;
      const roundNumber = Number(fixtureData.roundNumber);
      const blockedTeams = teamsOnCooldown(wagerHistory.docs
        .filter((document) => document.id !== wagerRef.id)
        .map((document) => ({
          roundNumber: Number(document.data().roundNumber),
          homeTeamId: document.data().homeTeamId as string,
          awayTeamId: document.data().awayTeamId as string,
        })), roundNumber);

      if (blockedTeams.has(fixtureData.homeTeam.id) || blockedTeams.has(fixtureData.awayTeam.id)) {
        throw Object.assign(new Error("One of these teams is unavailable because you wagered on it during the previous three gameweeks."), {
          code: "TEAM_WAGER_COOLDOWN",
          status: 409,
        });
      }

      transaction.set(wagerRef, {
        userId,
        fixtureId: input.wager.fixtureId,
        seasonId: fixtureData.seasonId,
        gameweekId,
        roundNumber,
        homeTeamId: fixtureData.homeTeam.id,
        awayTeamId: fixtureData.awayTeam.id,
        selection: fixtureOutcome(
          wagerPrediction.predictedHomeScore,
          wagerPrediction.predictedAwayScore,
        ),
        stakePoints: input.wager.stakePoints,
        status: "OPEN",
        returnPoints: null,
        submittedAt: existingWager.exists
          ? existingWager.data()!.submittedAt
          : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        settledAt: null,
      });
    }

    const walletValues = {
      availablePoints: availablePoints - stakeDifference,
      reservedPoints: reservedPoints + stakeDifference,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (wallet.exists) transaction.update(walletRef, walletValues);
    else transaction.create(walletRef, {
      userId,
      ...walletValues,
      predictionPoints: 0,
      predictionSeasonId: currentGameweek.seasonId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  const predictions = await getGameweekPredictions(userId, gameweekId);
  const wager = await getGameweekWager(userId, gameweekId);
  return { predictions, wager };
}
