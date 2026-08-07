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

function toGameweek(id: string, data: FirebaseFirestore.DocumentData): Gameweek {
  const now = Date.now();
  const startsAt = (data.startsAt as Timestamp).toDate();
  const endsAt = (data.endsAt as Timestamp).toDate();
  const status = now < startsAt.getTime()
    ? "UPCOMING"
    : now <= endsAt.getTime()
      ? "ACTIVE"
      : "COMPLETE";

  return {
    id,
    seasonId: data.seasonId as string,
    roundNumber: data.roundNumber as number,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    fixtureCount: data.fixtureCount as number,
    status,
  };
}

export async function getGameweeks() {
  await ensureFixturesCached();
  const metadata = await firestore.collection("syncMetadata").doc("fixtures").get();
  const seasonId = metadata.data()?.seasonId as string;
  const snapshot = await firestore.collection("gameweeks").where("seasonId", "==", seasonId).get();
  return snapshot.docs
    .map((doc) => toGameweek(doc.id, doc.data()))
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

export async function getCurrentGameweek() {
  const gameweeks = await getGameweeks();
  return gameweeks.find((gameweek) => gameweek.status === "ACTIVE")
    ?? gameweeks.find((gameweek) => gameweek.status === "UPCOMING")
    ?? gameweeks.at(-1)
    ?? null;
}

export async function getJoinGameweek() {
  const gameweeks = await getGameweeks();
  const now = Date.now();
  return gameweeks.find((gameweek) => new Date(gameweek.endsAt).getTime() >= now)
    ?? gameweeks.at(-1)
    ?? null;
}
