import { FieldValue } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { findTeam } from "../data/teams.js";
import { firestore } from "../firebase/admin.js";

export type ProfileInput = { uid: string; email: string; displayName: string; favoriteTeamId: string };

function currentSeasonId() {
  if (env.ACTIVE_SEASON_ID) return env.ACTIVE_SEASON_ID;
  const now = new Date();
  const startYear = now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
}

export function supporterLeagueIdentity(seasonId: string, teamId: string, uid: string) {
  const leagueId = `${seasonId}_team_${teamId}`;
  return { leagueId, membershipId: `${leagueId}_${uid}` };
}

export async function createProfile(input: ProfileInput) {
  const team = findTeam(input.favoriteTeamId);
  if (!team) throw Object.assign(new Error("Choose a valid team."), { code: "TEAM_NOT_FOUND", status: 404 });
  const seasonId = currentSeasonId();
  const { leagueId, membershipId } = supporterLeagueIdentity(seasonId, team.id, input.uid);
  const userRef = firestore.collection("users").doc(input.uid);
  const leagueRef = firestore.collection("leagues").doc(leagueId);
  const membershipRef = firestore.collection("leagueMemberships").doc(membershipId);

  await firestore.runTransaction(async (transaction) => {
    const [user, league, membership] = await Promise.all([transaction.get(userRef), transaction.get(leagueRef), transaction.get(membershipRef)]);
    if (!user.exists) transaction.create(userRef, { email: input.email, displayName: input.displayName, favoriteTeamId: team.id, role: "USER", activeSeasonId: seasonId, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    if (!league.exists) transaction.create(leagueRef, { seasonId, type: "TEAM_DEFAULT", name: `${team.name} Supporters`, normalizedName: `${team.name} supporters`.toLowerCase(), favoriteTeamId: team.id, ownerUserId: null, inviteCode: null, memberCount: 1, isActive: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    else if (!membership.exists) transaction.update(leagueRef, { memberCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    if (!membership.exists) transaction.create(membershipRef, { leagueId, userId: input.uid, seasonId, role: "MEMBER", leagueType: "TEAM_DEFAULT", joinedAt: FieldValue.serverTimestamp(), isActive: true });
  });

  return { uid: input.uid, email: input.email, displayName: input.displayName, favoriteTeam: team, league: { id: leagueId, name: `${team.name} Supporters`, type: "TEAM_DEFAULT" }, seasonId };
}

export async function getProfile(uid: string) {
  const snapshot = await firestore.collection("users").doc(uid).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  const team = findTeam(data.favoriteTeamId as string);
  const seasonId = data.activeSeasonId as string;
  return { uid, ...data, favoriteTeam: team, league: team ? { id: `${seasonId}_team_${team.id}`, name: `${team.name} Supporters`, type: "TEAM_DEFAULT" } : null };
}
