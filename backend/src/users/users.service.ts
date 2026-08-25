import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firebase/admin.js";
import { getJoinGameweek } from "../gameweeks/gameweeks.service.js";
import { getUserLeagues } from "../leagues/leagues.service.js";
import { STARTING_POINTS } from "../wagers/wagers.service.js";

export type ProfileInput = { uid: string; email: string; displayName: string };

export async function createProfile(input: ProfileInput) {
  const joinGameweek = await getJoinGameweek();
  if (!joinGameweek) throw new Error("No Premier League gameweek is available.");

  const seasonId = joinGameweek.seasonId;
  const userRef = firestore.collection("users").doc(input.uid);
  const walletRef = firestore.collection("pointWallets").doc(input.uid);

  await firestore.runTransaction(async (transaction) => {
    const [user, wallet] = await Promise.all([transaction.get(userRef), transaction.get(walletRef)]);

    if (!user.exists) {
      transaction.create(userRef, {
        email: input.email,
        displayName: input.displayName,
        role: "USER",
        activeSeasonId: seasonId,
        joinedGameweek: joinGameweek.roundNumber,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    if (!wallet.exists) {
      transaction.create(walletRef, {
        userId: input.uid,
        availablePoints: STARTING_POINTS,
        reservedPoints: 0,
        lifetimePointsStaked: 0,
        lifetimePointsReturned: 0,
        version: 1,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return getProfile(input.uid);
}

export async function getProfile(uid: string) {
  const snapshot = await firestore.collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  const [leagues, wallet] = await Promise.all([
    getUserLeagues(uid),
    firestore.collection("pointWallets").doc(uid).get(),
  ]);
  return { uid, ...data, leagues, wallet: wallet.exists ? wallet.data() : null };
}
