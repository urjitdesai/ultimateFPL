import { Timestamp } from "firebase-admin/firestore";
import { firestore } from "../firebase/admin.js";
import { ensureFixturesCached } from "../fixtures/fixtures.service.js";

export type Gameweek = {
  id: string;
  seasonId: string;
  roundNumber: number;
  startsAt: string;
  endsAt: string;
  fixtureCount: number;
  status: "UPCOMING" | "ACTIVE" | "COMPLETE";
};

const TERMINAL_FIXTURE_STATUSES = new Set([
  "COMPLETED",
  "POSTPONED",
  "CANCELLED",
  "ABANDONED",
]);

export function getGameweekStatus(
  startsAt: Date,
  fixtureStatuses: string[],
  now = new Date(),
): Gameweek["status"] {
  if (now.getTime() < startsAt.getTime()) return "UPCOMING";
  if (fixtureStatuses.length > 0
    && fixtureStatuses.every((status) => TERMINAL_FIXTURE_STATUSES.has(status))) {
    return "COMPLETE";
  }
  return "ACTIVE";
}

function toGameweek(
  id: string,
  data: FirebaseFirestore.DocumentData,
  fixtureStatuses: string[],
): Gameweek {
  const startsAt = (data.startsAt as Timestamp).toDate();
  const endsAt = (data.endsAt as Timestamp).toDate();

  return {
    id,
    seasonId: data.seasonId as string,
    roundNumber: data.roundNumber as number,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    fixtureCount: data.fixtureCount as number,
    status: getGameweekStatus(startsAt, fixtureStatuses),
  };
}

export async function getGameweeks() {
  await ensureFixturesCached();
  const metadata = await firestore.collection("syncMetadata").doc("fixtures").get();
  const seasonId = metadata.data()?.seasonId as string;
  const [gameweeks, fixtures] = await Promise.all([
    firestore.collection("gameweeks").where("seasonId", "==", seasonId).get(),
    firestore.collection("fixtures").where("seasonId", "==", seasonId).get(),
  ]);
  const statusesByGameweek = new Map<string, string[]>();
  for (const fixture of fixtures.docs) {
    const gameweekId = fixture.data().gameweekId as string;
    statusesByGameweek.set(gameweekId, [
      ...(statusesByGameweek.get(gameweekId) ?? []),
      fixture.data().normalizedStatus as string,
    ]);
  }

  return gameweeks.docs
    .map((doc) => toGameweek(doc.id, doc.data(), statusesByGameweek.get(doc.id) ?? []))
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

export async function getCurrentGameweek() {
  const gameweeks = await getGameweeks();
  return gameweeks.find((gameweek) => gameweek.status === "ACTIVE")
    ?? gameweeks.find((gameweek) => gameweek.status === "UPCOMING")
    ?? gameweeks.at(-1)
    ?? null;
}

export function selectJoinGameweek(gameweeks: Gameweek[], now = Date.now()) {
  return gameweeks.find((gameweek) => new Date(gameweek.startsAt).getTime() - 60 * 60 * 1000 > now)
    ?? gameweeks.at(-1)
    ?? null;
}

export async function getJoinGameweek() {
  return selectJoinGameweek(await getGameweeks());
}
