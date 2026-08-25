import crypto from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { firestore } from "../firebase/admin.js";
import { getGameweeks, getJoinGameweek, type Gameweek } from "../gameweeks/gameweeks.service.js";

export const createLeagueSchema = z.object({
  name: z.string().trim().min(3).max(50),
});
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

export function getMembershipStartRound(
  joinedGameweek: unknown,
  joinedAtMillis: number | null,
  gameweeks: Pick<Gameweek, "roundNumber" | "endsAt">[],
  fallbackRound = 1,
) {
  if (typeof joinedGameweek === "number" && Number.isInteger(joinedGameweek) && joinedGameweek > 0) {
    return joinedGameweek;
  }
  if (joinedAtMillis != null) {
    return gameweeks.find((gameweek) => new Date(gameweek.endsAt).getTime() >= joinedAtMillis)?.roundNumber
      ?? gameweeks.at(-1)?.roundNumber
      ?? fallbackRound;
  }
  return fallbackRound;
}

export async function createLeague(userId: string, name: string) {
  const userRef = firestore.collection("users").doc(userId);
  const joinGameweek = await getJoinGameweek();
  if (!joinGameweek) throw new Error("No Premier League gameweek is available.");
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
        joinedGameweek: joinGameweek.roundNumber,
        joinedAt: FieldValue.serverTimestamp(),
        isActive: true,
      });
      return true;
    });
    if (created) return { id: leagueRef.id, name, inviteCode, memberCount: 1 };
  }
  throw Object.assign(new Error("We couldn't generate an invite code. Try again."), { code: "INVITE_CODE_UNAVAILABLE", status: 503 });
}

export async function joinLeague(userId: string, rawInviteCode: string) {
  const inviteCode = normalizeInviteCode(rawInviteCode);
  if (inviteCode.length !== 8) {
    throw Object.assign(new Error("That league key isn't valid."), { code: "INVITE_CODE_INVALID", status: 404 });
  }
  const inviteRef = firestore.collection("leagueInvites").doc(inviteCode);
  const joinGameweek = await getJoinGameweek();
  if (!joinGameweek) throw new Error("No Premier League gameweek is available.");
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
    if (!league.exists || league.data()?.isActive !== true) {
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
      joinedGameweek: joinGameweek.roundNumber,
      joinedAt: FieldValue.serverTimestamp(),
      isActive: true,
    });
    transaction.update(leagueRef, { memberCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    return { id: league.id, ...league.data(), memberCount: Number(league.data()!.memberCount ?? 0) + 1 };
  });
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

  const [league, memberships, gameweeks, wagers] = await Promise.all([
    firestore.collection("leagues").doc(leagueId).get(),
    firestore.collection("leagueMemberships").where("leagueId", "==", leagueId).get(),
    getGameweeks(),
    firestore.collection("wagers").where("leagueId", "==", leagueId).get(),
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
    const [profile] = await Promise.all([
      firestore.collection("users").doc(memberUserId).get(),
    ]);
    const profileData = profile.data();
    const membershipData = member.data();
    const joinedAtMillis = membershipData.joinedAt instanceof Timestamp ? membershipData.joinedAt.toMillis() : null;
    const startRound = getMembershipStartRound(
      membershipData.joinedGameweek,
      joinedAtMillis,
      gameweeks,
      Number(profileData?.joinedGameweek ?? 1),
    );
    const settledWagers = wagers.docs.map((wager) => wager.data())
      .filter((wager) => wager.userId === memberUserId && ["WON", "LOST"].includes(wager.status)
        && (roundByGameweekId.get(wager.gameweekId) ?? 0) >= startRound);
    const wagerNetThrough = (round: number) => settledWagers.reduce((total, wager) => {
      if ((roundByGameweekId.get(wager.gameweekId) ?? 0) > round) return total;
      return total + Number(wager.netPoints ?? 0);
    }, 0);
    const currentWagerNet = wagerNetThrough(currentRound) - wagerNetThrough(currentRound - 1);

    return {
      userId: memberUserId,
      displayName: (profileData?.displayName as string | undefined) ?? "UFL Player",
      favoriteTeam: null,
      points: wagerNetThrough(currentRound),
      previousPoints: wagerNetThrough(currentRound - 1),
      gameweekPoints: currentWagerNet,
      exactScores: settledWagers.filter((wager) => wager.status === "WON" && (roundByGameweekId.get(wager.gameweekId) ?? 0) <= currentRound).length,
      previousExactScores: settledWagers.filter((wager) => wager.status === "WON" && (roundByGameweekId.get(wager.gameweekId) ?? 0) < currentRound).length,
      correctResults: settledWagers.filter((wager) => wager.status === "WON" && (roundByGameweekId.get(wager.gameweekId) ?? 0) <= currentRound).length,
      previousCorrectResults: settledWagers.filter((wager) => wager.status === "WON" && (roundByGameweekId.get(wager.gameweekId) ?? 0) < currentRound).length,
      joinedAt: joinedAtMillis ?? 0,
    } satisfies StandingCandidate;
  }));

  return {
    league: {
      id: league.id,
      name: league.data()!.name as string,
      memberCount: activeMemberships.length,
      inviteCode: league.data()!.inviteCode as string,
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
