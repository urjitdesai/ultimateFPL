import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { firestore } from "../firebase/admin.js";
import type { Team } from "../teams/teams.service.js";

type DefaultLeague = {
  id: string;
  name: string;
  type: "OVERALL" | "TEAM_DEFAULT" | "GAMEWEEK_DEFAULT";
  favoriteTeamId?: string;
  roundNumber?: number;
};

function membershipId(leagueId: string, userId: string) {
  return `${leagueId}_${userId}`;
}

export function getDefaultLeagues(seasonId: string, team: Team, roundNumber: number): DefaultLeague[] {
  return [
    { id: `${seasonId}_overall`, name: "Overall", type: "OVERALL" },
    { id: `${seasonId}_team_${team.id}`, name: `${team.name} Supporters`, type: "TEAM_DEFAULT", favoriteTeamId: team.id },
    { id: `${seasonId}_gameweek_${roundNumber}`, name: `Gameweek ${roundNumber}`, type: "GAMEWEEK_DEFAULT", roundNumber },
  ];
}

export async function joinDefaultLeagues(
  transaction: Transaction,
  userId: string,
  seasonId: string,
  team: Team,
  roundNumber: number,
) {
  const leagues = getDefaultLeagues(seasonId, team, roundNumber);
  const records = await Promise.all(leagues.map(async (league) => {
    const leagueRef = firestore.collection("leagues").doc(league.id);
    const memberRef = firestore.collection("leagueMemberships").doc(membershipId(league.id, userId));
    const [leagueSnapshot, memberSnapshot] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(memberRef),
    ]);
    return { league, leagueRef, memberRef, leagueSnapshot, memberSnapshot };
  }));

  for (const record of records) {
    const { league, leagueRef, memberRef, leagueSnapshot, memberSnapshot } = record;
    if (!leagueSnapshot.exists) {
      transaction.create(leagueRef, {
        seasonId,
        type: league.type,
        name: league.name,
        normalizedName: league.name.toLowerCase(),
        favoriteTeamId: league.favoriteTeamId ?? null,
        roundNumber: league.roundNumber ?? null,
        ownerUserId: null,
        inviteCode: null,
        memberCount: 1,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else if (!memberSnapshot.exists) {
      transaction.update(leagueRef, {
        memberCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    if (!memberSnapshot.exists) {
      transaction.create(memberRef, {
        leagueId: league.id,
        userId,
        seasonId,
        role: "MEMBER",
        leagueType: league.type,
        joinedAt: FieldValue.serverTimestamp(),
        isActive: true,
      });
    }
  }

  return leagues;
}

export async function getUserLeagues(userId: string) {
  const memberships = await firestore.collection("leagueMemberships")
    .where("userId", "==", userId)
    .get();
  const leagueSnapshots = await Promise.all(
    memberships.docs
      .filter((membership) => membership.data().isActive === true)
      .map((membership) => firestore.collection("leagues").doc(membership.data().leagueId).get()),
  );
  return leagueSnapshots.filter((snapshot) => snapshot.exists).map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}
