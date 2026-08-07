import { firestore } from "../firebase/admin.js";
import { ensureFixturesCached } from "../fixtures/fixtures.service.js";
import { decodeHtmlEntities } from "../utils/html.js";

export type Team = { id: string; name: string; shortName: string };

export async function getTeams(): Promise<Team[]> {
  await ensureFixturesCached();
  const snapshot = await firestore.collection("teams").where("isActive", "==", true).get();
  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      name: decodeHtmlEntities(doc.data().name as string),
      shortName: doc.data().shortName as string,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTeamById(id: string): Promise<Team | undefined> {
  await ensureFixturesCached();
  const snapshot = await firestore.collection("teams").doc(id).get();
  if (!snapshot.exists || snapshot.data()?.isActive !== true) return undefined;
  return {
    id: snapshot.id,
    name: decodeHtmlEntities(snapshot.data()!.name as string),
    shortName: snapshot.data()!.shortName as string,
  };
}
