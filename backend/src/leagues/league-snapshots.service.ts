import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";
import type { Gameweek } from "../gameweeks/gameweeks.service.js";
import { STARTING_TOTAL_POINTS } from "../points/points.constants.js";
import { teamLogoUrl } from "../utils/team-logo.js";
import { publicProfileNames } from "../users/profile-names.js";
import { getMembershipStartRound, rankLeagueStandings } from "./leagues.service.js";

function chunks<T>(values: T[]) {
  return Array.from({ length: Math.ceil(values.length / env.SCORING_BATCH_SIZE) }, (_, index) =>
    values.slice(index * env.SCORING_BATCH_SIZE, (index + 1) * env.SCORING_BATCH_SIZE));
}

function membershipStartRound(
  membership: FirebaseFirestore.DocumentData,
  profile: FirebaseFirestore.DocumentData | undefined,
  gameweeks: Gameweek[],
) {
  const joinedAtMillis = membership.joinedAt instanceof Timestamp ? membership.joinedAt.toMillis() : null;
  return Math.max(
    Number(profile?.joinedGameweek ?? 1),
    getMembershipStartRound(
      membership.joinedGameweek,
      joinedAtMillis,
      gameweeks,
      Number(profile?.joinedGameweek ?? 1),
    ),
  );
}

async function calculateLeagueSnapshot(
  league: FirebaseFirestore.DocumentSnapshot,
  gameweek: Gameweek,
  gameweeks: Gameweek[],
) {
  const memberships = await firestore.collection("leagueMemberships").where("leagueId", "==", league.id).get();
  const activeMemberships = memberships.docs.filter((document) => document.data().isActive === true);
  const roundByGameweekId = new Map(gameweeks.map((candidate) => [candidate.id, candidate.roundNumber]));
  const previousRound = gameweeks.filter((candidate) =>
    candidate.status === "COMPLETE" && candidate.roundNumber < gameweek.roundNumber)
    .reduce((latest, candidate) => Math.max(latest, candidate.roundNumber), 0);

  const candidates = await Promise.all(activeMemberships.map(async (membership) => {
    const memberUserId = membership.data().userId as string;
    const [profile, predictions, wagers] = await Promise.all([
      firestore.collection("users").doc(memberUserId).get(),
      firestore.collection("predictions").where("userId", "==", memberUserId).get(),
      firestore.collection("wagers").where("userId", "==", memberUserId).get(),
    ]);
    const profileData = profile.data();
    const favoriteTeamId = profileData?.favoriteTeamId as string | undefined;
    const team = favoriteTeamId ? await firestore.collection("teams").doc(favoriteTeamId).get() : null;
    const startRound = membershipStartRound(membership.data(), profileData, gameweeks);
    const scored = predictions.docs.map((prediction) => prediction.data()).filter((prediction) => {
      const round = roundByGameweekId.get(prediction.gameweekId) ?? 0;
      return prediction.awardedPoints != null && round >= startRound && round <= gameweek.roundNumber;
    });
    const throughPrevious = scored.filter((prediction) =>
      (roundByGameweekId.get(prediction.gameweekId) ?? 0) <= previousRound);
    const relevantWagers = wagers.docs.map((wager) => wager.data()).filter((wager) =>
      ["WON", "LOST"].includes(wager.status)
      && Number(wager.roundNumber) >= startRound
      && Number(wager.roundNumber) <= gameweek.roundNumber);
    const wagerNet = (entries: typeof relevantWagers) => entries.reduce(
      (total, wager) => total + Number(wager.returnPoints ?? 0) - Number(wager.stakePoints),
      0,
    );
    const throughPreviousWagers = relevantWagers.filter((wager) => Number(wager.roundNumber) <= previousRound);
    const correctReasons = new Set(["EXACT_SCORE", "CORRECT_GOAL_DIFFERENCE", "CORRECT_RESULT"]);
    const joinedAtMillis = membership.data().joinedAt instanceof Timestamp
      ? membership.data().joinedAt.toMillis()
      : 0;
    const names = publicProfileNames(profileData);
    return {
      userId: memberUserId,
      ...names,
      favoriteTeam: team?.exists ? {
        id: team.id,
        name: team.data()!.name as string,
        logoUrl: teamLogoUrl(team.id),
      } : null,
      points: STARTING_TOTAL_POINTS + scored.reduce((total, prediction) =>
        total + Number(prediction.awardedPoints), 0) + wagerNet(relevantWagers),
      previousPoints: STARTING_TOTAL_POINTS + throughPrevious.reduce((total, prediction) =>
        total + Number(prediction.awardedPoints), 0) + wagerNet(throughPreviousWagers),
      gameweekPoints: scored.filter((prediction) =>
        roundByGameweekId.get(prediction.gameweekId) === gameweek.roundNumber)
        .reduce((total, prediction) => total + Number(prediction.awardedPoints), 0)
        + wagerNet(relevantWagers.filter((wager) => Number(wager.roundNumber) === gameweek.roundNumber)),
      exactScores: scored.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      previousExactScores: throughPrevious.filter((prediction) => prediction.scoringReason === "EXACT_SCORE").length,
      correctResults: scored.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      previousCorrectResults: throughPrevious.filter((prediction) => correctReasons.has(prediction.scoringReason)).length,
      joinedAt: joinedAtMillis,
      scoringStartedGameweek: startRound,
    };
  }));
  return rankLeagueStandings(candidates);
}

export async function materializeLeagueSnapshots(
  gameweek: Gameweek,
  gameweeks: Gameweek[],
  leagueIds?: Set<string>,
) {
  const leagues = await firestore.collection("leagues").where("isActive", "==", true).get();
  for (const league of leagues.docs.filter((candidate) => !leagueIds || leagueIds.has(candidate.id))) {
    const standings = await calculateLeagueSnapshot(league, gameweek, gameweeks);
    const gameweekRef = league.ref.collection("gameweeks").doc(gameweek.id);
    const leaderboard = gameweekRef.collection("leaderboard");
    const existing = await leaderboard.get();
    const nextUserIds = new Set(standings.map((entry) => entry.userId));
    for (const staleChunk of chunks(existing.docs.filter((entry) => !nextUserIds.has(entry.id)))) {
      const batch = firestore.batch();
      staleChunk.forEach((entry) => batch.delete(entry.ref));
      await batch.commit();
    }
    for (const standingsChunk of chunks(standings)) {
      const batch = firestore.batch();
      standingsChunk.forEach((entry) => batch.set(leaderboard.doc(entry.userId), {
        ...entry,
        totalPoints: entry.points,
        updatedAt: FieldValue.serverTimestamp(),
      }));
      await batch.commit();
    }
    await gameweekRef.set({
      gameweekId: gameweek.id,
      roundNumber: gameweek.roundNumber,
      memberCount: standings.length,
      status: "FINALIZED",
      generatedFromLeagueUpdatedAt: league.data().updatedAt ?? null,
      finalizedAt: FieldValue.serverTimestamp(),
    });
  }
}

export async function refreshDirtyLatestSnapshots(gameweek: Gameweek, gameweeks: Gameweek[]) {
  const leagues = await firestore.collection("leagues").where("isActive", "==", true).get();
  const dirtyLeagueIds = new Set<string>();
  for (const league of leagues.docs) {
    const snapshot = await league.ref.collection("gameweeks").doc(gameweek.id).get();
    const leagueUpdatedAt = league.data().updatedAt;
    const snapshotLeagueUpdatedAt = snapshot.data()?.generatedFromLeagueUpdatedAt;
    if (!snapshot.exists
      || !(leagueUpdatedAt instanceof Timestamp)
      || !(snapshotLeagueUpdatedAt instanceof Timestamp)
      || leagueUpdatedAt.toMillis() > snapshotLeagueUpdatedAt.toMillis()) {
      dirtyLeagueIds.add(league.id);
    }
  }
  if (dirtyLeagueIds.size > 0) {
    await materializeLeagueSnapshots(gameweek, gameweeks, dirtyLeagueIds);
  }
}
