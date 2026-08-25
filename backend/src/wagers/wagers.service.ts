import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { env } from "../config/env.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";

export const STARTING_POINTS = env.STARTING_POINTS;
export const MAX_WAGER_POINTS = env.MAX_WAGER_POINTS_PER_FIXTURE;
export const SETTLEMENT_RULE_VERSION = env.SETTLEMENT_RULE_VERSION;

export const wagerInputSchema = z.object({
  selection: z.enum(["HOME_WIN", "DRAW", "AWAY_WIN"]),
  stakePoints: z.number().int().min(1).max(MAX_WAGER_POINTS),
});

export type WagerSelection = z.infer<typeof wagerInputSchema>["selection"];

function wagerId(userId: string, fixtureId: string) {
  return `${userId}_${fixtureId}`;
}

function serializeTimestamp(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

function serializeWager(id: string, data: FirebaseFirestore.DocumentData) {
  return {
    id,
    userId: data.userId as string,
    fixtureId: data.fixtureId as string,
    seasonId: data.seasonId as string,
    gameweekId: data.gameweekId as string,
    selection: data.selection as WagerSelection,
    stakePoints: Number(data.stakePoints),
    status: data.status as "OPEN" | "WON" | "LOST" | "VOID",
    returnPoints: data.returnPoints == null ? null : Number(data.returnPoints),
    netPoints: data.netPoints == null ? null : Number(data.netPoints),
    settlementReason: (data.settlementReason as string | null) ?? null,
    submittedAt: serializeTimestamp(data.submittedAt),
    updatedAt: serializeTimestamp(data.updatedAt),
    settledAt: serializeTimestamp(data.settledAt),
  };
}

export function fixtureOutcome(actualHome: number, actualAway: number): WagerSelection {
  if (actualHome === actualAway) return "DRAW";
  return actualHome > actualAway ? "HOME_WIN" : "AWAY_WIN";
}

export function settleWager(
  selection: WagerSelection,
  stakePoints: number,
  actualHome: number,
  actualAway: number,
) {
  const won = selection === fixtureOutcome(actualHome, actualAway);
  return {
    status: won ? "WON" as const : "LOST" as const,
    returnPoints: won ? stakePoints * 2 : 0,
    netPoints: won ? stakePoints : -stakePoints,
    reason: won ? "CORRECT_OUTCOME" as const : "INCORRECT_OUTCOME" as const,
    ruleVersion: SETTLEMENT_RULE_VERSION,
  };
}

export async function getWallet(userId: string) {
  const wallet = await firestore.collection("pointWallets").doc(userId).get();
  if (!wallet.exists) {
    throw Object.assign(new Error("Complete your profile to receive points."), { code: "WALLET_NOT_FOUND", status: 404 });
  }
  return {
    availablePoints: Number(wallet.data()!.availablePoints),
    reservedPoints: Number(wallet.data()!.reservedPoints),
    lifetimePointsStaked: Number(wallet.data()!.lifetimePointsStaked ?? 0),
    lifetimePointsReturned: Number(wallet.data()!.lifetimePointsReturned ?? 0),
  };
}

export async function upsertWager(userId: string, fixtureId: string, input: z.infer<typeof wagerInputSchema>) {
  const wagerRef = firestore.collection("wagers").doc(wagerId(userId, fixtureId));
  const walletRef = firestore.collection("pointWallets").doc(userId);
  const fixtureRef = firestore.collection("fixtures").doc(fixtureId);

  await firestore.runTransaction(async (transaction) => {
    const [fixture, wallet, existing] = await Promise.all([
      transaction.get(fixtureRef),
      transaction.get(walletRef),
      transaction.get(wagerRef),
    ]);
    if (!fixture.exists) throw Object.assign(new Error("Fixture not found."), { code: "FIXTURE_NOT_FOUND", status: 404 });
    if (!wallet.exists) throw Object.assign(new Error("Points wallet not found."), { code: "WALLET_NOT_FOUND", status: 404 });
    const kickoffAt = fixture.data()!.kickoffAt as Timestamp;
    if (!(kickoffAt instanceof Timestamp) || Date.now() >= kickoffAt.toMillis()) {
      throw Object.assign(new Error("Wagers for this fixture are locked because the match has started."), { code: "WAGER_LOCKED", status: 409 });
    }
    if (existing.exists && existing.data()!.status !== "OPEN") {
      throw Object.assign(new Error("This wager has already been settled."), { code: "WAGER_SETTLED", status: 409 });
    }

    const previousStake = existing.exists ? Number(existing.data()!.stakePoints) : 0;
    const stakeDifference = input.stakePoints - previousStake;
    const availablePoints = Number(wallet.data()!.availablePoints);
    const reservedPoints = Number(wallet.data()!.reservedPoints);
    if (stakeDifference > availablePoints) {
      throw Object.assign(new Error("You don't have enough available points."), { code: "INSUFFICIENT_POINTS", status: 409 });
    }

    transaction.set(walletRef, {
      availablePoints: availablePoints - stakeDifference,
      reservedPoints: reservedPoints + stakeDifference,
      lifetimePointsStaked: FieldValue.increment(Math.max(0, stakeDifference)),
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(wagerRef, {
      userId,
      fixtureId,
      seasonId: fixture.data()!.seasonId,
      gameweekId: fixture.data()!.gameweekId,
      selection: input.selection,
      stakePoints: input.stakePoints,
      status: "OPEN",
      returnPoints: null,
      netPoints: null,
      settlementReason: null,
      settlementRuleVersion: null,
      fixtureResultVersion: null,
      submittedAt: existing.exists ? existing.data()!.submittedAt : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      settledAt: null,
    });
  });

  const saved = await wagerRef.get();
  return serializeWager(saved.id, saved.data()!);
}

export async function deleteWager(userId: string, fixtureId: string) {
  const wagerRef = firestore.collection("wagers").doc(wagerId(userId, fixtureId));
  const walletRef = firestore.collection("pointWallets").doc(userId);
  await firestore.runTransaction(async (transaction) => {
    const [wager, wallet, fixture] = await Promise.all([
      transaction.get(wagerRef),
      transaction.get(walletRef),
      transaction.get(firestore.collection("fixtures").doc(fixtureId)),
    ]);
    if (!wager.exists) return;
    if (!fixture.exists || Date.now() >= (fixture.data()!.kickoffAt as Timestamp).toMillis()) {
      throw Object.assign(new Error("Wagers for this fixture are locked because the match has started."), { code: "WAGER_LOCKED", status: 409 });
    }
    if (wager.data()!.status !== "OPEN") throw Object.assign(new Error("This wager has already been settled."), { code: "WAGER_SETTLED", status: 409 });
    const stake = Number(wager.data()!.stakePoints);
    transaction.update(walletRef, {
      availablePoints: Number(wallet.data()!.availablePoints) + stake,
      reservedPoints: Number(wallet.data()!.reservedPoints) - stake,
      version: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.delete(wagerRef);
  });
}

export async function getMyGameweekWagers(userId: string, gameweekId: string) {
  const fixtures = await getFixturesForGameweek(gameweekId);
  await Promise.all(fixtures.filter((fixture) => fixture.normalizedStatus === "COMPLETED").map((fixture) => settleFixtureWagers(fixture.id)));
  const [wagers, wallet] = await Promise.all([
    firestore.collection("wagers").where("userId", "==", userId).where("gameweekId", "==", gameweekId).get(),
    getWallet(userId),
  ]);
  const byFixture = new Map(wagers.docs.map((wager) => [wager.data().fixtureId as string, serializeWager(wager.id, wager.data())]));
  return { wallet, fixtures: fixtures.map((fixture) => ({ ...fixture, wager: byFixture.get(fixture.id) ?? null })) };
}

export async function getVisibleFixtureWagers(userId: string, fixtureId: string) {
  const fixture = await firestore.collection("fixtures").doc(fixtureId).get();
  if (!fixture.exists) throw Object.assign(new Error("Fixture not found."), { code: "FIXTURE_NOT_FOUND", status: 404 });
  const hasKickedOff = Date.now() >= (fixture.data()!.kickoffAt as Timestamp).toMillis();
  const snapshot = await firestore.collection("wagers").where("fixtureId", "==", fixtureId).get();
  return snapshot.docs
    .filter((wager) => hasKickedOff || wager.data().userId === userId)
    .map((wager) => serializeWager(wager.id, wager.data()));
}

export async function settleFixtureWagers(fixtureId: string) {
  const fixtureRef = firestore.collection("fixtures").doc(fixtureId);
  const [fixture, wagers] = await Promise.all([
    fixtureRef.get(),
    firestore.collection("wagers").where("fixtureId", "==", fixtureId).get(),
  ]);
  if (!fixture.exists || fixture.data()!.normalizedStatus !== "COMPLETED"
    || fixture.data()!.homeScore == null || fixture.data()!.awayScore == null) return;
  const resultVersion = String(fixture.data()!.resultVersion ?? `${fixture.data()!.homeScore}:${fixture.data()!.awayScore}`);

  for (const wagerSnapshot of wagers.docs) {
    await firestore.runTransaction(async (transaction) => {
      const wager = await transaction.get(wagerSnapshot.ref);
      if (!wager.exists || wager.data()!.status !== "OPEN") return;
      const walletRef = firestore.collection("pointWallets").doc(wager.data()!.userId);
      const wallet = await transaction.get(walletRef);
      const result = settleWager(wager.data()!.selection, Number(wager.data()!.stakePoints), fixture.data()!.homeScore, fixture.data()!.awayScore);
      transaction.update(walletRef, {
        availablePoints: Number(wallet.data()!.availablePoints) + result.returnPoints,
        reservedPoints: Number(wallet.data()!.reservedPoints) - Number(wager.data()!.stakePoints),
        lifetimePointsReturned: FieldValue.increment(result.returnPoints),
        version: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(wager.ref, {
        status: result.status,
        returnPoints: result.returnPoints,
        netPoints: result.netPoints,
        settlementReason: result.reason,
        settlementRuleVersion: result.ruleVersion,
        fixtureResultVersion: resultVersion,
        settledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
}
