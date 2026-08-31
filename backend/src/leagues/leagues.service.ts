import crypto from "node:crypto";
import { FieldValue, Timestamp, type Transaction } from "firebase-admin/firestore";
import { z } from "zod";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";
import { gameweekLockDeadline } from "../gameweeks/gameweek-deadline.js";
import { getGameweeks, getJoinGameweek, type Gameweek } from "../gameweeks/gameweeks.service.js";
import { getFixturesForGameweek } from "../fixtures/fixtures.service.js";
import type { Team } from "../teams/teams.service.js";
import { teamLogoUrl } from "../utils/team-logo.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import { publicProfileNames } from "../users/profile-names.js";

export const createLeagueSchema = z.object({
  name: z.string().trim().min(3).max(50),
});
export const joinLeagueSchema = z.object({ inviteCode: z.string().trim().min(6).max(12) });
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function membershipId(leagueId: string, userId: string) {
  return `${leagueId}_${userId}`;
}

function isPrivateLeague(data: FirebaseFirestore.DocumentData | undefined) {
  return data?.isActive === true
    && typeof data.ownerUserId === "string"
    && typeof data.inviteCode === "string";
}

function isActiveLeague(data: FirebaseFirestore.DocumentData | undefined) {
  return data?.isActive === true;
}

export function defaultLeagueRecords(seasonId: string, teams: Team[], roundNumbers: number[]) {
  return [
    { id: `${seasonId}_overall`, name: "Overall", favoriteTeamId: null, roundNumber: null },
    ...teams.map((team) => ({
      id: `${seasonId}_team_${team.id}`,
      name: `${team.name} Supporters`,
      favoriteTeamId: team.id,
      roundNumber: null,
    })),
    ...roundNumbers.map((roundNumber) => ({
      id: `${seasonId}_gameweek_${roundNumber}`,
      name: `Gameweek ${roundNumber}`,
      favoriteTeamId: null,
      roundNumber,
    })),
  ];
}

export async function ensureDefaultLeagues() {
  const { ensureFixturesCached } = await import("../fixtures/fixtures.service.js");
  await ensureFixturesCached();
  const metadata = await firestore.collection("syncMetadata").doc("fixtures").get();
  const seasonId = metadata.data()?.seasonId as string | undefined;
  if (!seasonId) return;

  const [teamsSnapshot, gameweeksSnapshot] = await Promise.all([
    firestore.collection("teams").where("isActive", "==", true).get(),
    firestore.collection("gameweeks").where("seasonId", "==", seasonId).get(),
  ]);
  const teams = teamsSnapshot.docs.map((document) => ({
    id: document.id,
    name: document.data().name as string,
    shortName: document.data().shortName as string,
    logoUrl: teamLogoUrl(document.id),
  }));
  const roundNumbers = gameweeksSnapshot.docs
    .map((document) => Number(document.data().roundNumber))
    .filter((roundNumber) => Number.isInteger(roundNumber) && roundNumber > 0)
    .sort((left, right) => left - right);
  const leagues = defaultLeagueRecords(seasonId, teams, roundNumbers);
  const leagueRefs = leagues.map((league) => firestore.collection("leagues").doc(league.id));
  const existingLeagues = await firestore.getAll(...leagueRefs);
  const batch = firestore.batch();
  leagues.forEach((league, index) => {
    const leagueRef = leagueRefs[index]!;
    const commonFields = {
      seasonId,
      name: league.name,
      normalizedName: league.name.toLowerCase(),
      favoriteTeamId: league.favoriteTeamId,
      roundNumber: league.roundNumber,
      isDefault: true,
      ownerUserId: null,
      inviteCode: null,
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (existingLeagues[index]?.exists) batch.set(leagueRef, commonFields, { merge: true });
    else batch.create(leagueRef, { ...commonFields, memberCount: 0, createdAt: FieldValue.serverTimestamp() });
  });
  await batch.commit();
}

export async function joinDefaultLeagues(
  transaction: Transaction,
  userId: string,
  seasonId: string,
  favoriteTeamId: string,
  joinedGameweek: number,
) {
  const leagueIds = [
    `${seasonId}_overall`,
    `${seasonId}_team_${favoriteTeamId}`,
    `${seasonId}_gameweek_${joinedGameweek}`,
  ];
  const records = await Promise.all(leagueIds.map(async (leagueId) => {
    const leagueRef = firestore.collection("leagues").doc(leagueId);
    const membershipRef = firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId));
    const [league, membership] = await Promise.all([
      transaction.get(leagueRef),
      transaction.get(membershipRef),
    ]);
    return { leagueId, leagueRef, membershipRef, league, membership };
  }));

  for (const record of records) {
    if (!record.league.exists || record.membership.exists) continue;
    transaction.create(record.membershipRef, {
      leagueId: record.leagueId,
      userId,
      seasonId,
      role: "MEMBER",
      joinedGameweek,
      joinedAt: FieldValue.serverTimestamp(),
      isActive: true,
    });
    transaction.update(record.leagueRef, {
      memberCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function generateInviteCode() {
  return Array.from(crypto.randomBytes(8), (byte) => INVITE_ALPHABET[byte % INVITE_ALPHABET.length]).join("");
}

export function createdLeagueLimitReached(
  activeCreatedLeagueCount: number,
  maximum = env.MAX_CREATED_LEAGUES_PER_USER,
) {
  return activeCreatedLeagueCount >= maximum;
}

export function privateLeagueMemberLimitReached(
  memberCount: number,
  maximum = env.MAX_PRIVATE_LEAGUE_MEMBERS,
) {
  return memberCount >= maximum;
}

export function getMembershipStartRound(
  joinedGameweek: unknown,
  joinedAtMillis: number | null,
  gameweeks: Pick<Gameweek, "roundNumber" | "startsAt" | "endsAt">[],
  fallbackRound = 1,
) {
  if (typeof joinedGameweek === "number" && Number.isInteger(joinedGameweek) && joinedGameweek > 0) {
    const joinedRound = gameweeks.find((gameweek) => gameweek.roundNumber === joinedGameweek);
    if (joinedAtMillis != null && joinedRound
      && joinedAtMillis >= gameweekLockDeadline(joinedRound.startsAt)) {
      return joinedGameweek + 1;
    }
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
  const ownedLeaguesQuery = firestore.collection("leagues").where("ownerUserId", "==", userId);
  const joinGameweek = await getJoinGameweek();
  if (!joinGameweek) throw new Error("No Premier League gameweek is available.");
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const leagueRef = firestore.collection("leagues").doc();
    const inviteCode = generateInviteCode();
    const inviteRef = firestore.collection("leagueInvites").doc(inviteCode);
    const created = await firestore.runTransaction(async (transaction) => {
      const [user, invite, ownedLeagues] = await Promise.all([
        transaction.get(userRef),
        transaction.get(inviteRef),
        transaction.get(ownedLeaguesQuery),
      ]);
      if (!user.exists) throw Object.assign(new Error("Complete your profile first."), { code: "PROFILE_REQUIRED", status: 409 });
      const activeCreatedLeagueCount = ownedLeagues.docs.filter((league) => league.data().isActive === true).length;
      if (createdLeagueLimitReached(activeCreatedLeagueCount)) {
        throw Object.assign(
          new Error(`You can create up to ${env.MAX_CREATED_LEAGUES_PER_USER} leagues.`),
          { code: "LEAGUE_CREATION_LIMIT_REACHED", status: 409 },
        );
      }
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
    if (!league.exists || !isPrivateLeague(league.data())) {
      throw Object.assign(new Error("That league is no longer available."), { code: "LEAGUE_NOT_FOUND", status: 404 });
    }
    if (league.data()!.seasonId !== user.data()!.activeSeasonId) {
      throw Object.assign(new Error("That league belongs to a different season."), { code: "LEAGUE_SEASON_MISMATCH", status: 409 });
    }
    if (membership.exists && membership.data()?.isActive === true) {
      return { id: league.id, ...league.data() };
    }
    if (privateLeagueMemberLimitReached(Number(league.data()!.memberCount ?? 0))) {
      throw Object.assign(
        new Error("That league has reached its member limit."),
        { code: "LEAGUE_MEMBER_LIMIT_REACHED", status: 409 },
      );
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
  return leagueSnapshots.filter((snapshot) => snapshot.exists && isActiveLeague(snapshot.data()))
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
}

type StandingCandidate = {
  userId: string;
  displayName: string;
  managerName: string;
  userName: string;
  favoriteTeam: { id: string; name: string; logoUrl: string } | null;
  points: number;
  previousPoints: number;
  gameweekPoints: number;
  exactScores: number;
  previousExactScores: number;
  correctResults: number;
  previousCorrectResults: number;
  joinedAt: number;
  scoringStartedGameweek: number;
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
  const previousRanks = new Map<string, number>();
  let previousPoints: number | null = null;
  let previousRank = 0;
  previous.forEach((candidate, index) => {
    if (previousPoints == null || candidate.previousPoints !== previousPoints) previousRank = index + 1;
    previousRanks.set(candidate.userId, previousRank);
    previousPoints = candidate.previousPoints;
  });
  let currentPoints: number | null = null;
  let currentRank = 0;
  return current.map((candidate, index) => {
    if (currentPoints == null || candidate.points !== currentPoints) currentRank = index + 1;
    const candidatePreviousRank = previousRanks.get(candidate.userId) ?? currentRank;
    currentPoints = candidate.points;
    return { ...candidate, rank: currentRank, previousRank: candidatePreviousRank, rankChange: candidatePreviousRank - currentRank };
  });
}

export function selectStandingsGameweeks(gameweeks: Array<Pick<Gameweek, "roundNumber" | "status">>) {
  const completedRounds = gameweeks
    .filter((gameweek) => gameweek.status === "COMPLETE")
    .map((gameweek) => gameweek.roundNumber);
  const currentGameweek = completedRounds.reduce((latest, roundNumber) => Math.max(latest, roundNumber), 0);
  const previousGameweek = completedRounds
    .filter((roundNumber) => roundNumber < currentGameweek)
    .reduce((latest, roundNumber) => Math.max(latest, roundNumber), 0);
  return { currentGameweek, previousGameweek: previousGameweek || null };
}

export async function getLeagueStandings(userId: string, leagueId: string) {
  const membership = await firestore.collection("leagueMemberships").doc(membershipId(leagueId, userId)).get();
  if (!membership.exists || membership.data()?.isActive !== true) {
    throw Object.assign(new Error("You are not a member of this league."), { code: "LEAGUE_PERMISSION_DENIED", status: 403 });
  }

  if (env.SCORING_MODE === "scheduled") {
    const [league, memberships, gameweeks] = await Promise.all([
      firestore.collection("leagues").doc(leagueId).get(),
      firestore.collection("leagueMemberships").where("leagueId", "==", leagueId).get(),
      getGameweeks(),
    ]);
    if (!league.exists || !isActiveLeague(league.data())) {
      throw Object.assign(new Error("League not found."), { code: "LEAGUE_NOT_FOUND", status: 404 });
    }
    const activeMemberships = memberships.docs.filter((document) => document.data().isActive === true);
    const finalized = gameweeks.filter((gameweek) => gameweek.settlementStatus === "FINALIZED")
      .sort((left, right) => left.roundNumber - right.roundNumber);
    const latest = finalized.at(-1) ?? null;
    const hasNewerCompleteGameweek = gameweeks.some((gameweek) =>
      gameweek.status === "COMPLETE" && gameweek.roundNumber > (latest?.roundNumber ?? 0));
    if (!latest) {
      return {
        league: { id: league.id, name: league.data()!.name as string, memberCount: activeMemberships.length, inviteCode: league.data()!.inviteCode as string },
        currentGameweek: 0,
        previousGameweek: null,
        status: hasNewerCompleteGameweek ? "FINALIZING" as const : "EMPTY" as const,
        lastUpdatedAt: null,
        standings: [],
      };
    }
    const snapshotRef = league.ref.collection("gameweeks").doc(latest.id);
    const [snapshot, entries] = await Promise.all([
      snapshotRef.get(),
      snapshotRef.collection("leaderboard").orderBy("rank", "asc").get(),
    ]);
    const lastUpdatedAt = snapshot.data()?.finalizedAt;
    return {
      league: { id: league.id, name: league.data()!.name as string, memberCount: activeMemberships.length, inviteCode: league.data()!.inviteCode as string },
      currentGameweek: latest.roundNumber,
      previousGameweek: finalized.at(-2)?.roundNumber ?? null,
      status: hasNewerCompleteGameweek || !snapshot.exists ? "FINALIZING" as const : "FINALIZED" as const,
      lastUpdatedAt: lastUpdatedAt instanceof Timestamp ? lastUpdatedAt.toDate().toISOString() : null,
      standings: entries.docs.map((entry) => {
        const data = entry.data();
        return {
          ...data,
          ...publicProfileNames(data),
          totalPoints: Number(data.totalPoints ?? data.points ?? STARTING_TOTAL_POINTS),
          isCurrentUser: entry.id === userId,
        };
      }),
    };
  }

  const [league, memberships, gameweeks] = await Promise.all([
    firestore.collection("leagues").doc(leagueId).get(),
    firestore.collection("leagueMemberships").where("leagueId", "==", leagueId).get(),
    getGameweeks(),
  ]);
  if (!league.exists || !isActiveLeague(league.data())) {
    throw Object.assign(new Error("League not found."), { code: "LEAGUE_NOT_FOUND", status: 404 });
  }

  const activeMemberships = memberships.docs.filter((document) => document.data().isActive === true);
  const standingsGameweeks = selectStandingsGameweeks(gameweeks);
  const currentRound = standingsGameweeks.currentGameweek;
  const roundByGameweekId = new Map(gameweeks.map((gameweek) => [gameweek.id, gameweek.roundNumber]));

  const candidates = await Promise.all(activeMemberships.map(async (member) => {
    const memberUserId = member.data().userId as string;
    const [profile, predictions, wagers] = await Promise.all([
      firestore.collection("users").doc(memberUserId).get(),
      firestore.collection("predictions").where("userId", "==", memberUserId).get(),
      firestore.collection("wagers").where("userId", "==", memberUserId).get(),
    ]);
    const profileData = profile.data();
    const favoriteTeamId = profileData?.favoriteTeamId as string | undefined;
    const team = favoriteTeamId ? await firestore.collection("teams").doc(favoriteTeamId).get() : null;
    const membershipData = member.data();
    const joinedAtMillis = membershipData.joinedAt instanceof Timestamp ? membershipData.joinedAt.toMillis() : null;
    const membershipStartRound = getMembershipStartRound(
      membershipData.joinedGameweek,
      joinedAtMillis,
      gameweeks,
      Number(profileData?.joinedGameweek ?? 1),
    );
    const startRound = Math.max(Number(profileData?.joinedGameweek ?? 1), membershipStartRound);
    const scored = predictions.docs.map((prediction) => prediction.data())
      .filter((prediction) => prediction.awardedPoints != null
        && (roundByGameweekId.get(prediction.gameweekId) ?? 0) >= startRound);
    const throughCurrent = scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId)! <= currentRound);
    const throughPrevious = scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId)! < currentRound);
    const relevantWagers = wagers.docs.map((wager) => wager.data()).filter((wager) =>
      Number(wager.roundNumber) >= startRound);
    const wagerNet = (entries: typeof relevantWagers) => entries.reduce(
      (total, wager) => total + Number(wager.returnPoints ?? 0) - Number(wager.stakePoints),
      0,
    );
    const throughCurrentWagers = relevantWagers.filter((wager) => Number(wager.roundNumber) <= currentRound);
    const throughPreviousWagers = relevantWagers.filter((wager) => Number(wager.roundNumber) < currentRound);
    const correctReasons = new Set(["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_RESULT"]);
    const names = publicProfileNames(profileData);
    return {
      userId: memberUserId,
      ...names,
      favoriteTeam: team?.exists ? {
        id: team.id,
        name: team.data()!.name as string,
        logoUrl: teamLogoUrl(team.id),
      } : null,
      points: STARTING_TOTAL_POINTS + throughCurrent.reduce((total, prediction) => total + Number(prediction.awardedPoints), 0) + wagerNet(throughCurrentWagers),
      previousPoints: STARTING_TOTAL_POINTS + throughPrevious.reduce((total, prediction) => total + Number(prediction.awardedPoints), 0) + wagerNet(throughPreviousWagers),
      gameweekPoints: scored.filter((prediction) => roundByGameweekId.get(prediction.gameweekId) === currentRound)
        .reduce((total, prediction) => total + Number(prediction.awardedPoints), 0)
        + wagerNet(relevantWagers.filter((wager) => Number(wager.roundNumber) === currentRound)),
      exactScores: throughCurrent.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      previousExactScores: throughPrevious.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      correctResults: throughCurrent.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      previousCorrectResults: throughPrevious.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      joinedAt: joinedAtMillis ?? 0,
      scoringStartedGameweek: startRound,
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
    previousGameweek: standingsGameweeks.previousGameweek,
    status: currentRound > 0 ? "FINALIZED" as const : "EMPTY" as const,
    lastUpdatedAt: null,
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
  if (!league.exists || !isActiveLeague(league.data()) || !profile.exists) {
    throw Object.assign(new Error("League player not found."), { code: "LEAGUE_PLAYER_NOT_FOUND", status: 404 });
  }

  const membershipData = memberMembership.data()!;
  const joinedAtMillis = membershipData.joinedAt instanceof Timestamp ? membershipData.joinedAt.toMillis() : null;
  const startRound = Math.max(
    Number(profile.data()!.joinedGameweek ?? 1),
    getMembershipStartRound(membershipData.joinedGameweek, joinedAtMillis, gameweeks, Number(profile.data()!.joinedGameweek ?? 1)),
  );
  const availableGameweeks = gameweeks.filter((gameweek) => gameweek.status === "COMPLETE" && gameweek.roundNumber >= startRound);
  const selectedGameweek = requestedGameweekId
    ? availableGameweeks.find((gameweek) => gameweek.id === requestedGameweekId)
    : availableGameweeks.at(-1);
  if (requestedGameweekId && !selectedGameweek) {
    throw Object.assign(new Error("Only completed gameweeks can be viewed."), { code: "GAMEWEEK_NOT_COMPLETE", status: 409 });
  }
  const profileData = profile.data()!;
  const names = publicProfileNames(profileData);
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
      ...names,
      favoriteTeam: team?.exists ? { id: team.id, name: team.data()!.name as string, logoUrl: teamLogoUrl(team.id) } : null,
    },
    gameweeks: availableGameweeks.map(({ id, roundNumber }) => ({ id, roundNumber })),
    selectedGameweek: selectedGameweek ? { id: selectedGameweek.id, roundNumber: selectedGameweek.roundNumber } : null,
    eligibility: { startsGameweek: startRound },
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
