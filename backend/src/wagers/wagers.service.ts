import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { getCurrentGameweek, getGameweeks } from "../gameweeks/gameweeks.service.js";
import { getMembershipStartRound } from "../leagues/leagues.service.js";
import { gameweekLockDeadline } from "../predictions/predictions.service.js";
import { scorePrediction } from "../predictions/predictions.scoring.js";

export const createWagerSchema = z.object({ fixtureId: z.string().min(1), stake: z.number().int().min(1).max(20) });

function membershipId(leagueId: string, userId: string) { return `${leagueId}_${userId}`; }
function balanceId(leagueId: string, userId: string) { return `${leagueId}_${userId}`; }
function predictionId(userId: string, fixtureId: string) { return `${userId}_${fixtureId}`; }

async function getBaseLeaguePoints(userId: string, leagueId: string) {
  const [membership, predictions, gameweeks] = await Promise.all([
    firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId)).get(),
    firestore.collection("predictions").where("userId", "==", userId).get(),
    getGameweeks(),
  ]);
  if (!membership.exists || membership.data()?.isActive !== true) {
    throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
  }
  const joinedAt = membership.data()!.joinedAt instanceof Timestamp ? membership.data()!.joinedAt.toMillis() : null;
  const startRound = getMembershipStartRound(membership.data()!.joinedGameweek, joinedAt, gameweeks);
  const rounds = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek.roundNumber]));
  return predictions.docs.map((prediction) => prediction.data())
    .filter((prediction) => prediction.awardedPoints != null && (rounds.get(prediction.gameweekId) ?? 0) >= startRound)
    .reduce((sum, prediction) => sum + Number(prediction.awardedPoints), 0);
}

function assertBeforeDeadline(gameweek: FirebaseFirestore.DocumentData) {
  const startsAt = gameweek.startsAt as Timestamp;
  if (Date.now() >= startsAt.toMillis() - 60 * 60 * 1000) {
    throw Object.assign(new Error("Wagers lock one hour before the gameweek starts."), { code: "WAGER_LOCKED", status: 409 });
  }
}

function predictionView(data: FirebaseFirestore.DocumentData) {
  return { predictedHomeScore: Number(data.predictedHomeScore), predictedAwayScore: Number(data.predictedAwayScore) };
}

export function getWagerOutcome(
  creatorPrediction: { predictedHomeScore: number; predictedAwayScore: number },
  opponentPrediction: { predictedHomeScore: number; predictedAwayScore: number },
  actualHome: number,
  actualAway: number,
) {
  const basePoints = (prediction: typeof creatorPrediction) => scorePrediction({
    predictedHome: prediction.predictedHomeScore,
    predictedAway: prediction.predictedAwayScore,
    actualHome,
    actualAway,
    isCaptain: false,
  }).basePoints;
  const creatorPoints = basePoints(creatorPrediction);
  const opponentPoints = basePoints(opponentPrediction);
  return { creatorPoints, opponentPoints, winner: creatorPoints === opponentPoints ? "TIE" as const : creatorPoints > opponentPoints ? "CREATOR" as const : "OPPONENT" as const };
}

export async function createWager(userId: string, leagueId: string, fixtureId: string, stake: number) {
  const basePoints = await getBaseLeaguePoints(userId, leagueId);
  const wagerRef = firestore.collection("wagers").doc();
  await firestore.runTransaction(async (transaction) => {
    const leagueRef = firestore.collection("leagues").doc(leagueId);
    const membershipRef = firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId));
    const fixtureRef = firestore.collection("fixtures").doc(fixtureId);
    const predictionRef = firestore.collection("predictions").doc(predictionId(userId, fixtureId));
    const balanceRef = firestore.collection("leagueWagerBalances").doc(balanceId(leagueId, userId));
    const [league, membership, fixture, prediction, balance] = await Promise.all([
      transaction.get(leagueRef), transaction.get(membershipRef), transaction.get(fixtureRef),
      transaction.get(predictionRef), transaction.get(balanceRef),
    ]);
    if (!league.exists || league.data()?.scoringType !== "WAGER") throw Object.assign(new Error("This is not a wager league."), { code: "WAGER_LEAGUE_REQUIRED", status: 409 });
    if (!membership.exists || membership.data()?.isActive !== true) throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
    if (!fixture.exists || !prediction.exists) throw Object.assign(new Error("Save a prediction for this fixture before wagering."), { code: "PREDICTION_REQUIRED", status: 409 });
    const gameweek = await transaction.get(firestore.collection("gameweeks").doc(fixture.data()!.gameweekId));
    if (!gameweek.exists) throw Object.assign(new Error("Gameweek not found."), { code: "GAMEWEEK_NOT_FOUND", status: 404 });
    assertBeforeDeadline(gameweek.data()!);
    const netPoints = Number(balance.data()?.netPoints ?? 0);
    const lockedPoints = Number(balance.data()?.lockedPoints ?? 0);
    if (basePoints + netPoints - lockedPoints < stake) throw Object.assign(new Error("You don't have enough available league points."), { code: "INSUFFICIENT_POINTS", status: 409 });
    transaction.set(balanceRef, { leagueId, userId, netPoints, lockedPoints: lockedPoints + stake, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.create(wagerRef, {
      leagueId, fixtureId, gameweekId: fixture.data()!.gameweekId, stake,
      creatorUserId: userId, creatorPrediction: predictionView(prediction.data()!), opponentUserId: null,
      opponentPrediction: null, status: "OPEN", winnerUserId: null, loserUserId: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return { id: wagerRef.id };
}

export async function matchWager(userId: string, leagueId: string, wagerId: string) {
  const basePoints = await getBaseLeaguePoints(userId, leagueId);
  await firestore.runTransaction(async (transaction) => {
    const wagerRef = firestore.collection("wagers").doc(wagerId);
    const membershipRef = firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId));
    const balanceRef = firestore.collection("leagueWagerBalances").doc(balanceId(leagueId, userId));
    const [wager, membership, balance] = await Promise.all([transaction.get(wagerRef), transaction.get(membershipRef), transaction.get(balanceRef)]);
    if (!wager.exists || wager.data()?.leagueId !== leagueId || wager.data()?.status !== "OPEN") throw Object.assign(new Error("This wager is no longer open."), { code: "WAGER_NOT_OPEN", status: 409 });
    if (wager.data()!.creatorUserId === userId) throw Object.assign(new Error("You cannot match your own wager."), { code: "WAGER_SELF_MATCH", status: 409 });
    if (!membership.exists || membership.data()?.isActive !== true) throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
    const prediction = await transaction.get(firestore.collection("predictions").doc(predictionId(userId, wager.data()!.fixtureId)));
    const gameweek = await transaction.get(firestore.collection("gameweeks").doc(wager.data()!.gameweekId));
    if (!prediction.exists) throw Object.assign(new Error("Save a prediction for this fixture before matching."), { code: "PREDICTION_REQUIRED", status: 409 });
    assertBeforeDeadline(gameweek.data()!);
    const stake = Number(wager.data()!.stake);
    const netPoints = Number(balance.data()?.netPoints ?? 0);
    const lockedPoints = Number(balance.data()?.lockedPoints ?? 0);
    if (basePoints + netPoints - lockedPoints < stake) throw Object.assign(new Error("You don't have enough available league points."), { code: "INSUFFICIENT_POINTS", status: 409 });
    transaction.set(balanceRef, { leagueId, userId, netPoints, lockedPoints: lockedPoints + stake, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.update(wagerRef, { opponentUserId: userId, opponentPrediction: predictionView(prediction.data()!), status: "MATCHED", matchedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function cancelWager(userId: string, leagueId: string, wagerId: string) {
  await firestore.runTransaction(async (transaction) => {
    const wagerRef = firestore.collection("wagers").doc(wagerId);
    const wager = await transaction.get(wagerRef);
    if (!wager.exists || wager.data()?.leagueId !== leagueId || !["OPEN", "MATCHED"].includes(wager.data()?.status)) throw Object.assign(new Error("This wager cannot be cancelled."), { code: "WAGER_NOT_CANCELLABLE", status: 409 });
    const data = wager.data()!;
    if (data.creatorUserId !== userId && data.opponentUserId !== userId) throw Object.assign(new Error("Only a participant can cancel this wager."), { code: "WAGER_PERMISSION_DENIED", status: 403 });
    const gameweek = await transaction.get(firestore.collection("gameweeks").doc(data.gameweekId));
    assertBeforeDeadline(gameweek.data()!);
    const participants = [data.creatorUserId, data.opponentUserId].filter(Boolean) as string[];
    const balances = await Promise.all(participants.map((participant) => transaction.get(firestore.collection("leagueWagerBalances").doc(balanceId(leagueId, participant)))));
    participants.forEach((participant, index) => transaction.set(balances[index]!.ref, {
      lockedPoints: Math.max(0, Number(balances[index]!.data()?.lockedPoints ?? 0) - Number(data.stake)),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }));
    transaction.update(wagerRef, { status: "CANCELLED", cancelledByUserId: userId, cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
  });
}

export async function settleFixtureWagers(fixtureId: string) {
  const [fixture, wagers] = await Promise.all([
    firestore.collection("fixtures").doc(fixtureId).get(),
    firestore.collection("wagers").where("fixtureId", "==", fixtureId).get(),
  ]);
  if (!fixture.exists || fixture.data()?.normalizedStatus !== "COMPLETED" || fixture.data()?.homeScore == null || fixture.data()?.awayScore == null) return;
  for (const wagerSnapshot of wagers.docs) {
    await firestore.runTransaction(async (transaction) => {
      const wager = await transaction.get(wagerSnapshot.ref);
      if (!wager.exists || !["OPEN", "MATCHED"].includes(wager.data()?.status)) return;
      const data = wager.data()!;
      const participants = [data.creatorUserId, data.opponentUserId].filter(Boolean) as string[];
      const balances = await Promise.all(participants.map((participant) => transaction.get(firestore.collection("leagueWagerBalances").doc(balanceId(data.leagueId, participant)))));
      if (data.status === "OPEN") {
        transaction.set(balances[0]!.ref, { lockedPoints: Math.max(0, Number(balances[0]!.data()?.lockedPoints ?? 0) - Number(data.stake)), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        transaction.update(wager.ref, { status: "REFUNDED", settledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      const { creatorPoints, opponentPoints, winner } = getWagerOutcome(data.creatorPrediction, data.opponentPrediction, fixture.data()!.homeScore, fixture.data()!.awayScore);
      if (winner === "TIE") {
        participants.forEach((participant, index) => transaction.set(balances[index]!.ref, { lockedPoints: Math.max(0, Number(balances[index]!.data()?.lockedPoints ?? 0) - Number(data.stake)), updatedAt: FieldValue.serverTimestamp() }, { merge: true }));
        transaction.update(wager.ref, { status: "REFUNDED", creatorBasePoints: creatorPoints, opponentBasePoints: opponentPoints, settledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        return;
      }
      const winnerUserId = winner === "CREATOR" ? data.creatorUserId : data.opponentUserId;
      const loserUserId = winner === "CREATOR" ? data.opponentUserId : data.creatorUserId;
      participants.forEach((participant, index) => transaction.set(balances[index]!.ref, {
        lockedPoints: Math.max(0, Number(balances[index]!.data()?.lockedPoints ?? 0) - Number(data.stake)),
        netPoints: Number(balances[index]!.data()?.netPoints ?? 0) + (participant === winnerUserId ? Number(data.stake) : -Number(data.stake)),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true }));
      transaction.update(wager.ref, { status: "SETTLED", winnerUserId, loserUserId, creatorBasePoints: creatorPoints, opponentBasePoints: opponentPoints, settledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
  }
}

async function refundExpiredOpenWagers(leagueId: string, gameweekId: string) {
  const wagers = await firestore.collection("wagers").where("leagueId", "==", leagueId).get();
  for (const wagerSnapshot of wagers.docs.filter((wager) => wager.data().gameweekId === gameweekId && wager.data().status === "OPEN")) {
    await firestore.runTransaction(async (transaction) => {
      const wager = await transaction.get(wagerSnapshot.ref);
      if (!wager.exists || wager.data()?.status !== "OPEN") return;
      const data = wager.data()!;
      const balanceRef = firestore.collection("leagueWagerBalances").doc(balanceId(leagueId, data.creatorUserId));
      const balance = await transaction.get(balanceRef);
      transaction.set(balanceRef, { lockedPoints: Math.max(0, Number(balance.data()?.lockedPoints ?? 0) - Number(data.stake)), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      transaction.update(wager.ref, { status: "REFUNDED", settledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    });
  }
}

export async function getWagerBoard(userId: string, leagueId: string) {
  const [league, membership, currentGameweek, basePoints, initialWagers] = await Promise.all([
    firestore.collection("leagues").doc(leagueId).get(),
    firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId)).get(),
    getCurrentGameweek(), getBaseLeaguePoints(userId, leagueId),
    firestore.collection("wagers").where("leagueId", "==", leagueId).get(),
  ]);
  if (!league.exists || league.data()?.scoringType !== "WAGER") throw Object.assign(new Error("This is not a wager league."), { code: "WAGER_LEAGUE_REQUIRED", status: 409 });
  if (!membership.exists || membership.data()?.isActive !== true) throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
  const wagersOpen = Boolean(currentGameweek && Date.now() < gameweekLockDeadline(currentGameweek.startsAt));
  if (currentGameweek && !wagersOpen && initialWagers.docs.some((wager) => wager.data().gameweekId === currentGameweek.id && wager.data().status === "OPEN")) {
    await refundExpiredOpenWagers(leagueId, currentGameweek.id);
  }
  const wagerSnapshot = currentGameweek && !wagersOpen ? await firestore.collection("wagers").where("leagueId", "==", leagueId).get() : initialWagers;
  const [fixtures, balance] = await Promise.all([
    currentGameweek ? getFixturesForGameweek(currentGameweek.id) : Promise.resolve([]),
    firestore.collection("leagueWagerBalances").doc(balanceId(leagueId, userId)).get(),
  ]);
  const predictionSnapshots = await Promise.all(fixtures.map((fixture) => firestore.collection("predictions").doc(predictionId(userId, fixture.id)).get()));
  const predictions = new Map(predictionSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => [snapshot.data()!.fixtureId as string, predictionView(snapshot.data()!)]));
  const userIds = new Set<string>();
  wagerSnapshot.docs.forEach((wager) => { userIds.add(wager.data().creatorUserId); if (wager.data().opponentUserId) userIds.add(wager.data().opponentUserId); });
  const profiles = new Map((await Promise.all([...userIds].map((id) => firestore.collection("users").doc(id).get()))).map((profile) => [profile.id, profile.data()?.displayName ?? "UFL Player"]));
  const lockedPoints = Number(balance.data()?.lockedPoints ?? 0);
  const netPoints = Number(balance.data()?.netPoints ?? 0);
  return {
    league: { id: league.id, name: league.data()!.name }, currentGameweek,
    deadline: currentGameweek ? new Date(gameweekLockDeadline(currentGameweek.startsAt)).toISOString() : null,
    wagersOpen,
    balance: { totalPoints: basePoints + netPoints, lockedPoints, availablePoints: Math.max(0, basePoints + netPoints - lockedPoints) },
    fixtures: fixtures.map((fixture) => ({ ...fixture, prediction: predictions.get(fixture.id) ?? null })),
    wagers: wagerSnapshot.docs.map((wager) => ({ id: wager.id, ...wager.data(), creatorDisplayName: profiles.get(wager.data().creatorUserId), opponentDisplayName: wager.data().opponentUserId ? profiles.get(wager.data().opponentUserId) : null, isParticipant: [wager.data().creatorUserId, wager.data().opponentUserId].includes(userId), isCreator: wager.data().creatorUserId === userId })),
  };
}
