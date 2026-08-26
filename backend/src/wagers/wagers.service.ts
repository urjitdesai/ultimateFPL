import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";

export const MAX_WAGER_POINTS = 20;
export const TEAM_COOLDOWN_GAMEWEEKS = 3;

export const wagerInputSchema = z.object({
  fixtureId: z.string().min(1),
  selection: z.enum(["HOME_WIN", "DRAW", "AWAY_WIN"]),
  stakePoints: z.number().int().min(1).max(MAX_WAGER_POINTS),
});

export type WagerSelection = z.infer<typeof wagerInputSchema>["selection"];

function wagerId(userId: string, gameweekId: string) {
  return `${userId}_${gameweekId}`;
}

function walletView(data: FirebaseFirestore.DocumentData) {
  return {
    availablePoints: Number(data.availablePoints),
    reservedPoints: Number(data.reservedPoints ?? 0),
  };
}

function wagerView(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    fixtureId: data.fixtureId as string,
    gameweekId: data.gameweekId as string,
    roundNumber: Number(data.roundNumber),
    selection: data.selection as WagerSelection,
    stakePoints: Number(data.stakePoints),
    status: data.status as "OPEN" | "WON" | "LOST",
    returnPoints: data.returnPoints == null ? null : Number(data.returnPoints),
  };
}

export function fixtureOutcome(homeScore: number, awayScore: number): WagerSelection {
  if (homeScore === awayScore) return "DRAW";
  return homeScore > awayScore ? "HOME_WIN" : "AWAY_WIN";
}

export function settleWager(selection: WagerSelection, stakePoints: number, homeScore: number, awayScore: number) {
  const won = selection === fixtureOutcome(homeScore, awayScore);
  return { status: won ? "WON" as const : "LOST" as const, returnPoints: won ? stakePoints * 2 : 0 };
}

export function teamsOnCooldown(
  wagers: Array<{ roundNumber: number; homeTeamId: string; awayTeamId: string }>,
  currentRound: number,
) {
  const blocked = new Set<string>();
  for (const wager of wagers) {
    const distance = currentRound - wager.roundNumber;
    if (distance >= 1 && distance <= TEAM_COOLDOWN_GAMEWEEKS) {
      blocked.add(wager.homeTeamId);
      blocked.add(wager.awayTeamId);
    }
  }
  return blocked;
}

export async function ensureWallet(userId: string) {
  const walletRef = firestore.collection("pointWallets").doc(userId);
  const userRef = firestore.collection("users").doc(userId);
  await firestore.runTransaction(async (transaction) => {
    const [wallet, user] = await Promise.all([transaction.get(walletRef), transaction.get(userRef)]);
    if (!user.exists) {
      throw Object.assign(new Error("Complete your profile to receive wager points."), { code: "PROFILE_REQUIRED", status: 409 });
    }
    if (!wallet.exists) transaction.create(walletRef, {
      userId,
      availablePoints: STARTING_TOTAL_POINTS,
      reservedPoints: 0,
      predictionPoints: 0,
      predictionSeasonId: user.data()!.activeSeasonId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
  return walletRef.get();
}

export async function getGameweekWager(userId: string, gameweekId: string) {
  const fixtures = await getFixturesForGameweek(gameweekId);
  await Promise.all(fixtures
    .filter((fixture) => fixture.normalizedStatus === "COMPLETED")
    .map((fixture) => settleFixtureWagers(fixture.id)));
  const walletSnapshot = await ensureWallet(userId);
  const [wager, previousWagers] = await Promise.all([
    firestore.collection("wagers").doc(wagerId(userId, gameweekId)).get(),
    firestore.collection("wagers").where("userId", "==", userId).get(),
  ]);
  const roundNumber = fixtures[0]?.roundNumber ?? 0;
  const blockedTeams = teamsOnCooldown(previousWagers.docs.map((document) => ({
    roundNumber: Number(document.data().roundNumber),
    homeTeamId: document.data().homeTeamId as string,
    awayTeamId: document.data().awayTeamId as string,
  })), roundNumber);

  return {
    wallet: walletView(walletSnapshot.data()!),
    wager: wager.exists ? wagerView(wager.id, wager.data()!) : null,
    fixtures: fixtures.map((fixture) => ({
      ...fixture,
      wagerUnavailableReason: blockedTeams.has(fixture.homeTeam.id) || blockedTeams.has(fixture.awayTeam.id)
        ? "TEAM_COOLDOWN" as const
        : null,
    })),
  };
}

export async function saveGameweekWager(
  userId: string,
  gameweekId: string,
  input: z.infer<typeof wagerInputSchema>,
) {
  const wagerRef = firestore.collection("wagers").doc(wagerId(userId, gameweekId));
  const walletRef = firestore.collection("pointWallets").doc(userId);
  const fixtureRef = firestore.collection("fixtures").doc(input.fixtureId);
  const userRef = firestore.collection("users").doc(userId);
  const gameweekRef = firestore.collection("gameweeks").doc(gameweekId);
  const historyQuery = firestore.collection("wagers").where("userId", "==", userId);

  await ensureWallet(userId);
  await firestore.runTransaction(async (transaction) => {
    const [fixture, wallet, existing, history, user, gameweek] = await Promise.all([
      transaction.get(fixtureRef),
      transaction.get(walletRef),
      transaction.get(wagerRef),
      transaction.get(historyQuery),
      transaction.get(userRef),
      transaction.get(gameweekRef),
    ]);
    if (!fixture.exists || fixture.data()!.gameweekId !== gameweekId) {
      throw Object.assign(new Error("Choose a fixture from this gameweek."), { code: "FIXTURE_NOT_FOUND", status: 404 });
    }
    const fixtureData = fixture.data()!;
    const eligibleFrom = user.data()?.eligibleFromAt ?? user.data()?.createdAt;
    const joinedAfterDeadline = eligibleFrom instanceof Timestamp && gameweek.exists
      && gameweek.data()!.startsAt instanceof Timestamp
      && eligibleFrom.toMillis() >= (gameweek.data()!.startsAt as Timestamp).toMillis() - 60 * 60 * 1000;
    if (!user.exists || Number(user.data()!.joinedGameweek ?? 1) > Number(fixtureData.roundNumber) || joinedAfterDeadline) {
      throw Object.assign(new Error("You were not eligible to play in this gameweek."), { code: "USER_NOT_ELIGIBLE", status: 409 });
    }
    if (Date.now() >= (fixtureData.kickoffAt as Timestamp).toMillis()) {
      throw Object.assign(new Error("This fixture has already started."), { code: "WAGER_LOCKED", status: 409 });
    }
    if (existing.exists && existing.data()!.status !== "OPEN") {
      throw Object.assign(new Error("This wager has already been settled."), { code: "WAGER_SETTLED", status: 409 });
    }
    const roundNumber = Number(fixtureData.roundNumber);
    const blockedTeams = teamsOnCooldown(history.docs
      .filter((document) => document.id !== wagerRef.id)
      .map((document) => ({
        roundNumber: Number(document.data().roundNumber),
        homeTeamId: document.data().homeTeamId as string,
        awayTeamId: document.data().awayTeamId as string,
      })), roundNumber);
    if (blockedTeams.has(fixtureData.homeTeam.id) || blockedTeams.has(fixtureData.awayTeam.id)) {
      throw Object.assign(new Error("One of these teams is unavailable because you wagered on it during the previous three gameweeks."), { code: "TEAM_WAGER_COOLDOWN", status: 409 });
    }
    const previousStake = existing.exists ? Number(existing.data()!.stakePoints) : 0;
    const stakeDifference = input.stakePoints - previousStake;
    const availablePoints = Number(wallet.data()!.availablePoints);
    if (stakeDifference > availablePoints) {
      throw Object.assign(new Error("You do not have enough wager points."), { code: "INSUFFICIENT_WAGER_POINTS", status: 409 });
    }
    transaction.update(walletRef, {
      availablePoints: availablePoints - stakeDifference,
      reservedPoints: Number(wallet.data()!.reservedPoints ?? 0) + stakeDifference,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(wagerRef, {
      userId,
      fixtureId: input.fixtureId,
      seasonId: fixtureData.seasonId,
      gameweekId,
      roundNumber,
      homeTeamId: fixtureData.homeTeam.id,
      awayTeamId: fixtureData.awayTeam.id,
      selection: input.selection,
      stakePoints: input.stakePoints,
      status: "OPEN",
      returnPoints: null,
      submittedAt: existing.exists ? existing.data()!.submittedAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      settledAt: null,
    });
  });
  return getGameweekWager(userId, gameweekId);
}

export async function deleteGameweekWager(userId: string, gameweekId: string) {
  const wagerRef = firestore.collection("wagers").doc(wagerId(userId, gameweekId));
  const walletRef = firestore.collection("pointWallets").doc(userId);
  await firestore.runTransaction(async (transaction) => {
    const [wager, wallet] = await Promise.all([transaction.get(wagerRef), transaction.get(walletRef)]);
    if (!wager.exists) return;
    const fixture = await transaction.get(firestore.collection("fixtures").doc(wager.data()!.fixtureId));
    if (!fixture.exists || Date.now() >= (fixture.data()!.kickoffAt as Timestamp).toMillis()) {
      throw Object.assign(new Error("This wager can no longer be removed."), { code: "WAGER_LOCKED", status: 409 });
    }
    if (wager.data()!.status !== "OPEN") {
      throw Object.assign(new Error("This wager has already been settled."), { code: "WAGER_SETTLED", status: 409 });
    }
    const stake = Number(wager.data()!.stakePoints);
    transaction.update(walletRef, {
      availablePoints: Number(wallet.data()!.availablePoints) + stake,
      reservedPoints: Number(wallet.data()!.reservedPoints) - stake,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.delete(wagerRef);
  });
}

export async function settleFixtureWagers(fixtureId: string) {
  const fixture = await firestore.collection("fixtures").doc(fixtureId).get();
  if (!fixture.exists || fixture.data()!.normalizedStatus !== "COMPLETED"
    || fixture.data()!.homeScore == null || fixture.data()!.awayScore == null) return;
  const wagers = await firestore.collection("wagers").where("fixtureId", "==", fixtureId).get();
  for (const wagerSnapshot of wagers.docs) {
    await firestore.runTransaction(async (transaction) => {
      const wager = await transaction.get(wagerSnapshot.ref);
      if (!wager.exists || wager.data()!.status !== "OPEN") return;
      const walletRef = firestore.collection("pointWallets").doc(wager.data()!.userId);
      const wallet = await transaction.get(walletRef);
      const result = settleWager(
        wager.data()!.selection,
        Number(wager.data()!.stakePoints),
        Number(fixture.data()!.homeScore),
        Number(fixture.data()!.awayScore),
      );
      transaction.update(walletRef, {
        availablePoints: Number(wallet.data()!.availablePoints) + result.returnPoints,
        reservedPoints: Number(wallet.data()!.reservedPoints) - Number(wager.data()!.stakePoints),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(wager.ref, {
        ...result,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}
