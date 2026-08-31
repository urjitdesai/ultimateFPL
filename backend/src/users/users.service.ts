import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../firebase/admin.js";
import { getJoinGameweek } from "../gameweeks/gameweeks.service.js";
import { getUserLeagues, joinDefaultLeagues } from "../leagues/leagues.service.js";
import { getTeamById } from "../teams/teams.service.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import { publicProfileNames } from "./profile-names.js";

export type ProfileInput = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  managerName: string;
  favoriteTeamId: string;
};

export async function createProfile(input: ProfileInput) {
  const requestedTeam = await getTeamById(input.favoriteTeamId);
  if (!requestedTeam) throw Object.assign(new Error("Choose a valid team."), { code: "TEAM_NOT_FOUND", status: 404 });

  const joinGameweek = await getJoinGameweek();
  if (!joinGameweek) throw new Error("No Premier League gameweek is available.");

  const seasonId = joinGameweek.seasonId;
  const userRef = firestore.collection("users").doc(input.uid);
  const profileTeam = requestedTeam;

  await firestore.runTransaction(async (transaction) => {
    const user = await transaction.get(userRef);
    if (!user.exists) {
      await joinDefaultLeagues(
        transaction,
        input.uid,
        seasonId,
        profileTeam.id,
        joinGameweek.roundNumber,
      );
      transaction.create(userRef, {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        managerName: input.managerName,
        displayName: input.managerName,
        favoriteTeamId: profileTeam.id,
        role: "USER",
        activeSeasonId: seasonId,
        joinedGameweek: joinGameweek.roundNumber,
        eligibleFromAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(firestore.collection("pointWallets").doc(input.uid), {
        userId: input.uid,
        availablePoints: STARTING_TOTAL_POINTS,
        reservedPoints: 0,
        predictionPoints: 0,
        predictionSeasonId: seasonId,
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
  const team = await getTeamById(data.favoriteTeamId as string);
  const leagues = await getUserLeagues(uid);
  return { uid, ...data, ...publicProfileNames(data), favoriteTeam: team, leagues };
}
