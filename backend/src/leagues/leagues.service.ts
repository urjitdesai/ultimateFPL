import crypto from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getGameweeks } from "../gameweeks/gameweeks.service.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import type { Team } from "../teams/teams.service.js";
import { teamLogoUrl } from "../utils/team-logo.js";

type DefaultLeague = {
  id: string;
  name: string;
  type: "OVERALL" | "TEAM_DEFAULT" | "GAMEWEEK_DEFAULT";
  favoriteTeamId?: string;
  roundNumber?: number;
};

export const createLeagueSchema = z.object({ name: z.string().trim().min(3).max(50) });
export const joinLeagueSchema = z.object({ inviteCode: z.string().trim().min(6).max(12) });
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function membershipId(leagueId: string, userId: string) {
  return `${leagueId}_${userId}`;
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateInviteCode() {
  return Array.from(crypto.randomBytes(8), (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export async function createLeague(userId: string, name: string) {
  const userRef = firestore.collection("users").doc(userId);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const leagueRef = firestore.collection("leagues").doc();
    const inviteCode = generateInviteCode();
    const inviteRef = firestore.collection("leagueInvites").doc(inviteCode);
    const created = await firestore.runTransaction(async (transaction) => {
      const [user, invite] = await Promise.all([transaction.get(userRef), transaction.get(inviteRef)]);
      if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });
      if (invite.exists) return false;
      const seasonId = user.data()!.activeSeasonId as string;
      transaction.create(leagueRef, {
        seasonId,
        type: "CUSTOM",
        name,
        normalizedName: name.toLowerCase(),
        ownerUserId: userId,
        inviteCode,
        memberCount: 1,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(inviteRef, { leagueId: leagueRef.id, isActive: true, createdAt: FieldValue.serverTimestamp() });
      transaction.create(firestore.collection("leagueMemberships").doc(membershipId(leagueRef.id, userId)), {
        leagueId: leagueRef.id,
        userId,
        seasonId,
        role: "OWNER",
        leagueType: "CUSTOM",
        joinedAt: FieldValue.serverTimestamp(),
        isActive: true,
      });
      return true;
    });
    if (created) return { id: leagueRef.id, name, type: "CUSTOM" as const, inviteCode, memberCount: 1 };
  }
  throw Object.assign(new Error("We couldn't generate an invite code. Try again."), { code: "INVITE_CODE_UNAVAILABLE", status: 503 });
}

export async function joinLeague(userId: string, rawInviteCode: string) {
  const inviteCode = normalizeInviteCode(rawInviteCode);
  if (inviteCode.length !== 8) {
    throw Object.assign(new Error("That league key isn't valid."), { code: "INVITE_CODE_INVALID", status: 404 });
  }
  const inviteRef = firestore.collection("leagueInvites").doc(inviteCode);
  return firestore.runTransaction(async (transaction) => {
    const invite = await transaction.get(inviteRef);
    if (!invite.exists || invite.data()?.isActive !== true) {
      throw Object.assign(new Error("That league key isn't valid."), { code: "INVITE_CODE_INVALID", status: 404 });
    }
    const leagueId = invite.data()!.leagueId as string;
    const leagueRef = firestore.collection("leagues").doc(leagueId);
    const membershipRef = firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId));
    const userRef = firestore.collection("users").doc(userId);
    const [league, membership, user] = await Promise.all([
      transaction.get(leagueRef), transaction.get(membershipRef), transaction.get(userRef),
    ]);
    if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });
    if (!league.exists || league.data()?.isActive !== true || league.data()?.type !== "CUSTOM") {
      throw Object.assign(new Error("That league is no longer available."), { code: "LEAGUE_NOT_FOUND", status: 404 });
    }
    if (league.data()!.seasonId !== user.data()!.activeSeasonId) {
      throw Object.assign(new Error("That league belongs to a different season."), { code: "LEAGUE_SEASON_MISMATCH", status: 409 });
    }
    if (membership.exists && membership.data()?.isActive === true) {
      return { id: league.id, ...league.data() };
    }
    transaction.set(membershipRef, {
      leagueId,
      userId,
      seasonId: league.data()!.seasonId,
      role: "MEMBER",
      leagueType: "CUSTOM",
      joinedAt: FieldValue.serverTimestamp(),
      isActive: true,
    });
    transaction.update(leagueRef, { memberCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { id: league.id, ...league.data(), memberCount: Number(league.data()!.memberCount ?? 0) + 1 };
  });
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

type StandingCandidate = {
  userId: string;
  displayName: string;
  favoriteTeam: { id: string; name: string; logoUrl: string } | null;
  points: number;
  previousPoints: number;
  gameweekPoints: number;
  exactScores: number;
  previousExactScores: number;
  correctResults: number;
  previousCorrectResults: number;
  joinedAt: number;
};

function compareStandings(
  left: StandingCandidate,
  right: StandingCandidate,
  previous = false,
) {
  const pointsKey = previous ? "previousPoints" : "points";
  const exactKey = previous ? "previousExactScores" : "exactScores";
  const correctKey = previous ? "previousCorrectResults" : "correctResults";
  return right[pointsKey] - left[pointsKey]
    || right[exactKey] - left[exactKey]
    || right[correctKey] - left[correctKey]
    || left.joinedAt - right.joinedAt
    || left.userId.localeCompare(right.userId);
}

export function rankLeagueStandings(candidates: StandingCandidate[]) {
  const current = [...candidates].sort((left, right) => compareStandings(left, right));
  const previous = [...candidates].sort((left, right) => compareStandings(left, right, true));
  const previousRanks = new Map(previous.map((candidate, index) => [candidate.userId, index + 1]));
  return current.map((candidate, index) => {
    const rank = index + 1;
    const previousRank = previousRanks.get(candidate.userId) ?? rank;
    return { ...candidate, rank, previousRank, rankChange: previousRank - rank };
  });
}

export async function getLeagueStandings(userId: string, leagueId: string) {
  const membership = await firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId)).get();
  if (!membership.exists || membership.data()?.isActive !== true) {
    throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
  }

  const [league, memberships, gameweeks] = await Promise.all([
    firestore.collection("leagues").doc(leagueId).get(),
    firestore.collection("leagueMemberships").where("leagueId", "==", leagueId).get(),
    getGameweeks(),
  ]);
  if (!league.exists || league.data()?.isActive !== true) {
    throw Object.assign(new Error("League not found."), { code: "LEAGUE_NOT_FOUND", status: 404 });
  }

  const activeMemberships = memberships.docs.filter((document) => document.data().isActive === true);
  const currentGameweek = gameweeks.find((gameweek) => gameweek.status === "ACTIVE")
    ?? gameweeks.find((gameweek) => gameweek.status === "UPCOMING")
    ?? gameweeks.at(-1);
  const currentRound = currentGameweek?.roundNumber ?? 1;
  const roundByGameweekId = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek.roundNumber]));

  const candidates = await Promise.all(activeMemberships.map(async (member) => {
    const memberUserId = member.data().userId as string;
    const [profile, predictions] = await Promise.all([
      firestore.collection("users").doc(memberUserId).get(),
      firestore.collection("predictions").where("userId", "==", memberUserId).get(),
    ]);
    const profileData = profile.data();
    const favoriteTeamId = profileData?.favoriteTeamId as string | undefined;
    const team = favoriteTeamId ? await firestore.collection("teams").doc(favoriteTeamId).get() : null;
    const scored = predictions.docs.map((prediction) => prediction.data())
      .filter((prediction) => prediction.awardedPoints != null && roundByGameweekId.has(prediction.gameweekId));
    const throughCurrent = scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId)! <= currentRound);
    const throughPrevious = scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId)! < currentRound);
    const correctReasons = new Set(["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_RESULT"]);

    return {
      userId: memberUserId,
      displayName: (profileData?.displayName as string | undefined) ?? "UFL Player",
      favoriteTeam: team?.exists ? {
        id: team.id,
        name: team.data()!.name as string,
        logoUrl: teamLogoUrl(team.id),
      } : null,
      points: throughCurrent.reduce((total, prediction) => total + Number(prediction.awardedPoints), 0),
      previousPoints: throughPrevious.reduce((total, prediction) => total + Number(prediction.awardedPoints), 0),
      gameweekPoints: scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId) === currentRound)
        .reduce((total, prediction) => total + Number(prediction.awardedPoints), 0),
      exactScores: throughCurrent.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      previousExactScores: throughPrevious.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      correctResults: throughCurrent.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      previousCorrectResults: throughPrevious.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      joinedAt: member.data().joinedAt instanceof Timestamp ? member.data().joinedAt.toMillis() : 0,
    } satisfies StandingCandidate;
  }));

  return {
    league: {
      id: league.id,
      name: league.data()!.name as string,
      type: league.data()!.type as string,
      memberCount: activeMemberships.length,
      inviteCode: league.data()!.type === "CUSTOM" ? league.data()!.inviteCode as string : null,
    },
    currentGameweek: currentRound,
    previousGameweek: currentRound > 1 ? currentRound - 1 : null,
    standings: rankLeagueStandings(candidates).map((entry) => ({
      ...entry,
      totalPoints: entry.points,
      isCurrentUser: entry.userId === userId,
    })),
  };
}

export async function getLeagueMemberPredictions(
  userId: string,
  leagueId: string,
  memberUserId: string,
  requestedGameweekId?: string,
) {
  const [viewerMembership, memberMembership, league, gameweeks, profile] = await Promise.all([
    firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId)).get(),
    firestore.collection("leagueMemberships").doc(membershipId(leagueId, memberUserId)).get(),
    firestore.collection("leagues").doc(leagueId).get(),
    getGameweeks(),
    firestore.collection("users").doc(memberUserId).get(),
  ]);
  if (!viewerMembership.exists || viewerMembership.data()?.isActive !== true
    || !memberMembership.exists || memberMembership.data()?.isActive !== true) {
    throw Object.assign(new Error("Both players must be active members of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
  }
  if (!league.exists || league.data()?.isActive !== true || !profile.exists) {
    throw Object.assign(new Error("League player not found."), { code: "LEAGUE_PLAYER_NOT_FOUND", status: 404 });
  }

  const availableGameweeks = gameweeks.filter((gameweek) => gameweek.status === "COMPLETE");
  const selectedGameweek = requestedGameweekId
    ? availableGameweeks.find((gameweek) => gameweek.id === requestedGameweekId)
    : availableGameweeks.at(-1);
  if (requestedGameweekId && !selectedGameweek) {
    throw Object.assign(new Error("Only completed gameweeks can be viewed."), { code: "GAMEWEEK_NOT_COMPLETE", status: 409 });
  }
  const profileData = profile.data()!;
  const favoriteTeamId = profileData.favoriteTeamId as string | undefined;
  const [fixtures, team] = await Promise.all([
    selectedGameweek ? getFixturesForGameweek(selectedGameweek.id) : Promise.resolve([]),
    favoriteTeamId ? firestore.collection("teams").doc(favoriteTeamId).get() : null,
  ]);
  const predictionSnapshots = await Promise.all(fixtures.map((fixture) =>
    firestore.collection("predictions").doc(`${memberUserId}_${fixture.id}`).get()));
  const predictions = new Map(predictionSnapshots.filter((snapshot) => snapshot.exists)
    .map((snapshot) => [snapshot.data()!.fixtureId as string, snapshot.data()!]));

  return {
    league: { id: league.id, name: league.data()!.name as string },
    player: {
      userId: memberUserId,
      displayName: (profileData.displayName as string | undefined) ?? "UFL Player",
      favoriteTeam: team?.exists ? { id: team.id, name: team.data()!.name as string, logoUrl: teamLogoUrl(team.id) } : null,
    },
    gameweeks: availableGameweeks.map(({ id, roundNumber }) => ({ id, roundNumber })),
    selectedGameweek: selectedGameweek ? { id: selectedGameweek.id, roundNumber: selectedGameweek.roundNumber } : null,
    fixtures: fixtures.map((fixture) => {
      const prediction = predictions.get(fixture.id);
      return {
        ...fixture,
        prediction: {
          predictedHomeScore: Number(prediction?.predictedHomeScore ?? 0),
          predictedAwayScore: Number(prediction?.predictedAwayScore ?? 0),
          awardedPoints: Number(prediction?.awardedPoints ?? 0),
          scoringReason: (prediction?.scoringReason as string | null) ?? null,
          isCaptain: prediction?.isCaptain === true,
          isDefault: prediction?.isDefault === true || !prediction,
        },
      };
    }),
  };
}
