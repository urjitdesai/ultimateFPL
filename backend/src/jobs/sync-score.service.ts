import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";
import { ensureDefaultLeagues } from "../leagues/leagues.service.js";
import { materializeLeagueSnapshots, refreshDirtyLatestSnapshots } from "../leagues/league-snapshots.service.js";
import { refreshFixturesFromProvider } from "../fixtures/fixtures.service.js";
import { getGameweeks, type Gameweek } from "../gameweeks/gameweeks.service.js";
import { rebuildUserStats, settleFixturePredictions } from "../predictions/predictions.service.js";
import { SCORING_RULE_VERSION } from "../predictions/predictions.scoring.js";
import { settleFixtureWagers } from "../wagers/wagers.service.js";
import { gameweekRequiresScoring, providerSyncIsDue } from "./sync-policy.js";

const LOCK_ID = "sync-score";

function expiresAt(nowMillis: number) {
  return Timestamp.fromMillis(nowMillis + env.SCORING_RUN_RETENTION_DAYS * 86_400_000);
}

function runId() {
  return (process.env.CLOUD_RUN_EXECUTION ?? crypto.randomUUID()).replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function acquireLease(owner: string, nowMillis: number) {
  const reference = firestore.collection("jobLocks").doc(LOCK_ID);
  return firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    const currentExpiry = existing.data()?.expiresAt;
    if (existing.exists && currentExpiry instanceof Timestamp
      && currentExpiry.toMillis() > nowMillis && existing.data()?.owner !== owner) return false;
    transaction.set(reference, {
      owner,
      acquiredAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(nowMillis + env.SCORING_LEASE_MS),
    });
    return true;
  });
}

async function releaseLease(owner: string) {
  const reference = firestore.collection("jobLocks").doc(LOCK_ID);
  await firestore.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    if (existing.exists && existing.data()?.owner === owner) transaction.delete(reference);
  });
}

async function providerSyncDue(nowMillis: number) {
  const [metadata, fixtures] = await Promise.all([
    firestore.collection("syncMetadata").doc("fixtures").get(),
    firestore.collection("fixtures").get(),
  ]);
  const lastSyncedAt = metadata.data()?.synchronizedAt;
  return providerSyncIsDue(
    fixtures.docs.flatMap((fixture) => fixture.data().kickoffAt instanceof Timestamp
      ? [{ kickoffAtMillis: fixture.data().kickoffAt.toMillis() }]
      : []),
    lastSyncedAt instanceof Timestamp ? lastSyncedAt.toMillis() : null,
    nowMillis,
    {
      live: env.SYNC_LIVE_INTERVAL_MS,
      recent: env.SYNC_RECENT_INTERVAL_MS,
      idle: env.SYNC_IDLE_INTERVAL_MS,
    },
  );
}

async function gameweekFingerprint(gameweekId: string) {
  const fixtures = await firestore.collection("fixtures").where("gameweekId", "==", gameweekId).get();
  const serialized = fixtures.docs.sort((left, right) => left.id.localeCompare(right.id)).map((fixture) => {
    const data = fixture.data();
    return [fixture.id, data.normalizedStatus, data.homeScore ?? null, data.awayScore ?? null, data.resultVersion ?? null];
  });
  return crypto.createHash("sha256")
    .update(JSON.stringify({ scoringRuleVersion: SCORING_RULE_VERSION, fixtures: serialized }))
    .digest("hex")
    .slice(0, 24);
}

async function hasPendingFixtureSettlement(gameweekId: string) {
  const fixtures = await firestore.collection("fixtures").where("gameweekId", "==", gameweekId).get();
  return fixtures.docs.some((fixture) => {
    const data = fixture.data();
    return data.normalizedStatus === "COMPLETED"
      && data.resultVersion != null
      && data.settledResultVersion !== data.resultVersion;
  });
}

async function scoreGameweek(gameweek: Gameweek, fingerprint: string, executionId: string) {
  const scoringRunRef = firestore.collection("scoringRuns").doc(`${gameweek.id}_${fingerprint}`);
  const existingRun = await scoringRunRef.get();
  const gameweekRef = firestore.collection("gameweeks").doc(gameweek.id);
  await Promise.all([
    gameweekRef.set({ settlementStatus: "PROCESSING", settlementError: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    scoringRunRef.set({
      executionId,
      fixtureResultFingerprint: fingerprint,
      gameweekId: gameweek.id,
      phase: existingRun.data()?.phase ?? "FIXTURES",
      status: "RUNNING",
      startedAt: existingRun.data()?.startedAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(Date.now()),
    }, { merge: true }),
  ]);

  try {
    const fixtures = await firestore.collection("fixtures").where("gameweekId", "==", gameweek.id).get();
    const scorableFixtures = fixtures.docs.filter((fixture) => {
      const data = fixture.data();
      return data.normalizedStatus === "COMPLETED" && data.homeScore != null && data.awayScore != null;
    }).sort((left, right) => left.id.localeCompare(right.id));
    const startIndex = Math.min(Number(existingRun.data()?.nextFixtureIndex ?? 0), scorableFixtures.length);
    for (let index = startIndex; index < scorableFixtures.length; index += 1) {
      const fixture = scorableFixtures[index]!;
      await settleFixturePredictions(fixture.id, { rebuildStats: false });
      await settleFixtureWagers(fixture.id);
      await fixture.ref.set({
        isSettled: true,
        settledResultVersion: fixture.data().resultVersion ?? null,
        finalizedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await scoringRunRef.set({
        nextFixtureIndex: index + 1,
        phase: "FIXTURES",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    await scoringRunRef.set({ phase: "AGGREGATES", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const [predictions, wagers] = await Promise.all([
      firestore.collection("predictions").where("gameweekId", "==", gameweek.id).get(),
      firestore.collection("wagers").where("gameweekId", "==", gameweek.id).get(),
    ]);
    const userIds = [...new Set([
      ...predictions.docs.map((prediction) => prediction.data().userId as string),
      ...wagers.docs.map((wager) => wager.data().userId as string),
    ])].sort((left, right) => left.localeCompare(right));
    const aggregateCursor = existingRun.data()?.aggregateCursor as string | undefined;
    for (const userId of userIds.filter((candidate) => !aggregateCursor || candidate > aggregateCursor)) {
      await rebuildUserStats(userId, gameweek.seasonId);
      await scoringRunRef.set({ aggregateCursor: userId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
    await scoringRunRef.set({ phase: "SNAPSHOTS", updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return scoringRunRef;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown scoring failure";
    await Promise.all([
      scoringRunRef.set({ status: "FAILED", error: message, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      gameweekRef.set({ settlementStatus: "FAILED", settlementError: message, updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    throw error;
  }
}

async function settleAndFinalizeGameweeks(executionId: string) {
  const gameweeks = await getGameweeks();
  const complete = gameweeks.filter((gameweek) => gameweek.status === "COMPLETE")
    .sort((left, right) => left.roundNumber - right.roundNumber);
  const scoreableGameweeks = gameweeks.filter((gameweek) => ["ACTIVE", "COMPLETE"].includes(gameweek.status))
    .sort((left, right) => left.roundNumber - right.roundNumber);
  const fingerprints = new Map<string, string>();
  for (const gameweek of scoreableGameweeks) fingerprints.set(gameweek.id, await gameweekFingerprint(gameweek.id));
  const gameweekDocuments = await Promise.all(scoreableGameweeks.map((gameweek) =>
    firestore.collection("gameweeks").doc(gameweek.id).get()));
  const gameweekDocumentById = new Map(scoreableGameweeks.map((gameweek, index) =>
    [gameweek.id, gameweekDocuments[index]!]));
  const pendingSettlement = new Map<string, boolean>();
  for (const gameweek of scoreableGameweeks) {
    pendingSettlement.set(gameweek.id, await hasPendingFixtureSettlement(gameweek.id));
  }
  const staleComplete = complete.filter((gameweek) =>
    gameweekDocumentById.get(gameweek.id)?.data()?.finalizedResultFingerprint !== fingerprints.get(gameweek.id));
  const toScore = scoreableGameweeks.filter((gameweek) => gameweekRequiresScoring(
    gameweek.status,
    pendingSettlement.get(gameweek.id) === true,
    gameweekDocumentById.get(gameweek.id)?.data()?.finalizedResultFingerprint,
    fingerprints.get(gameweek.id)!,
  ));
  const scoringRuns = new Map<string, FirebaseFirestore.DocumentReference>();
  for (const gameweek of toScore) {
    const scoringRun = await scoreGameweek(gameweek, fingerprints.get(gameweek.id)!, executionId);
    scoringRuns.set(gameweek.id, scoringRun);
    if (gameweek.status === "ACTIVE") {
      await scoringRun.set({
        phase: "COMPLETE",
        status: "SUCCEEDED",
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  if (staleComplete.length > 0) {
    const earliestChangedRound = Math.min(...staleComplete.map((gameweek) => gameweek.roundNumber));
    for (const gameweek of complete.filter((candidate) => candidate.roundNumber >= earliestChangedRound)) {
      const scoringRun = scoringRuns.get(gameweek.id);
      try {
        await materializeLeagueSnapshots(gameweek, gameweeks);
        await firestore.collection("gameweeks").doc(gameweek.id).set({
          settlementStatus: "FINALIZED",
          settlementError: null,
          finalizedResultFingerprint: fingerprints.get(gameweek.id),
          finalizedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (scoringRun) await scoringRun.set({
          phase: "COMPLETE",
          status: "SUCCEEDED",
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown standings failure";
        await firestore.collection("gameweeks").doc(gameweek.id).set({
          settlementStatus: "FAILED",
          settlementError: message,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (scoringRun) await scoringRun.set({ status: "FAILED", error: message, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        throw error;
      }
    }
  }

  const latestFinalized = [...complete].reverse().find((gameweek) =>
    gameweekDocumentById.get(gameweek.id)?.data()?.settlementStatus === "FINALIZED"
    || staleComplete.some((candidate) => candidate.id === gameweek.id));
  if (latestFinalized) await refreshDirtyLatestSnapshots(latestFinalized, gameweeks);
  return { completedGameweeks: complete.length, rescoredGameweeks: toScore.length };
}

export async function runSyncAndScore() {
  const executionId = runId();
  const nowMillis = Date.now();
  const syncRunRef = firestore.collection("syncRuns").doc(executionId);
  if (!await acquireLease(executionId, nowMillis)) {
    await syncRunRef.set({
      environment: env.NODE_ENV,
      projectId: env.FIREBASE_PROJECT_ID,
      status: "SKIPPED_LOCKED",
      startedAt: FieldValue.serverTimestamp(),
      completedAt: FieldValue.serverTimestamp(),
      expiresAt: expiresAt(nowMillis),
    });
    return { status: "SKIPPED_LOCKED" as const };
  }

  await syncRunRef.set({
    environment: env.NODE_ENV,
    projectId: env.FIREBASE_PROJECT_ID,
    status: "RUNNING",
    startedAt: FieldValue.serverTimestamp(),
    expiresAt: expiresAt(nowMillis),
  });
  try {
    const refreshDue = await providerSyncDue(nowMillis);
    const refresh = refreshDue
      ? await refreshFixturesFromProvider({ settleCompleted: false })
      : null;
    if (refresh) await ensureDefaultLeagues();
    const scoring = await settleAndFinalizeGameweeks(executionId);
    const result = {
      status: "SUCCEEDED" as const,
      providerRequestCount: refresh?.providerRequestCount ?? 0,
      refreshed: refresh != null,
      ...scoring,
    };
    await syncRunRef.set({ ...result, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync-and-score failure";
    await syncRunRef.set({ status: "FAILED", error: message, completedAt: FieldValue.serverTimestamp() }, { merge: true });
    throw error;
  } finally {
    await releaseLease(executionId);
  }
}
