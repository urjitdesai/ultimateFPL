import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firebase/admin.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import { env } from "../config/env.js";

export const MAX_WAGER_POINTS = 50;
export const TEAM_COOLDOWN_GAMEWEEKS = 3;

export type WagerSelection = "HOME_WIN" | "DRAW" | "AWAY_WIN";

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
  if (env.SCORING_MODE === "request_driven") {
    for (const fixture of fixtures.filter((candidate) => candidate.normalizedStatus === "COMPLETED")) {
      await settleFixtureWagers(fixture.id);
    }
  }
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

export async function settleFixtureWagers(fixtureId: string) {
  const fixture = await firestore.collection("fixtures").doc(fixtureId).get();
  if (!fixture.exists || fixture.data()!.normalizedStatus !== "COMPLETED"
    || fixture.data()!.homeScore == null || fixture.data()!.awayScore == null) return;
  const wagers = await firestore.collection("wagers").where("fixtureId", "==", fixtureId).get();
  const affectedUserIds = new Set<string>();
  for (const wagerSnapshot of wagers.docs) {
    await firestore.runTransaction(async (transaction) => {
      const wager = await transaction.get(wagerSnapshot.ref);
      if (!wager.exists) return;
      const resultVersion = fixture.data()!.resultVersion as string | null | undefined;
      if (resultVersion && wager.data()!.settledResultVersion === resultVersion) return;
      const walletRef = firestore.collection("pointWallets").doc(wager.data()!.userId);
      const wallet = await transaction.get(walletRef);
      if (!wallet.exists) return;
      const result = settleWager(
        wager.data()!.selection,
        Number(wager.data()!.stakePoints),
        Number(fixture.data()!.homeScore),
        Number(fixture.data()!.awayScore),
      );
      const wasOpen = wager.data()!.status === "OPEN";
      const previousReturnPoints = wasOpen ? 0 : Number(wager.data()!.returnPoints ?? 0);
      transaction.update(walletRef, {
        availablePoints: Number(wallet.data()!.availablePoints) + result.returnPoints - previousReturnPoints,
        reservedPoints: Math.max(
          0,
          Number(wallet.data()!.reservedPoints) - (wasOpen ? Number(wager.data()!.stakePoints) : 0),
        ),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(wager.ref, {
        ...result,
        settledResultVersion: resultVersion ?? null,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      affectedUserIds.add(wager.data()!.userId);
    });
  }
  return affectedUserIds;
}
