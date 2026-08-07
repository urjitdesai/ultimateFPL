import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { z } from "zod";
import { env } from "../config/env.js";
import { firestore } from "../firebase/admin.js";

const teamSchema = z.object({
  team_id: z.number(),
  team_name: z.string(),
  team_logo: z.string().nullable().optional(),
});

const providerMatchSchema = z.object({
  match_id: z.number(),
  match_date: z.string(),
  date_unix: z.number(),
  status: z.string(),
  round_id: z.number().nullable().optional(),
  game_week: z.number().nullable().optional(),
  season: z.object({ season_id: z.number(), year: z.number() }),
  home_team: teamSchema,
  away_team: teamSchema,
  score: z.object({ home: z.number().nullable(), away: z.number().nullable() }).optional(),
});

type ProviderMatch = z.infer<typeof providerMatchSchema>;

type ProviderPage = {
  success: boolean;
  data: { matches: unknown[] };
  meta?: { pagination?: { total_pages?: number } };
};

let fixtureSync: Promise<void> | null = null;

async function providerRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${env.BACKEND_API.replace(/\/$/, "")}${path}`, {
    headers: { authorization: `Bearer ${env.BACKEND_API_TOKEN}` },
  });

  if (!response.ok) {
    throw Object.assign(new Error("Football data is temporarily unavailable."), {
      code: "PROVIDER_UNAVAILABLE",
      status: 503,
    });
  }

  return response.json() as Promise<T>;
}

async function discoverCompetition() {
  const leagueId = env.FOOTBALLDATA_IO_LEAGUE_ID;

  if (env.FOOTBALLDATA_IO_SEASON_ID) {
    return {
      leagueId,
      seasonId: env.FOOTBALLDATA_IO_SEASON_ID,
      seasonYear: null,
    };
  }

  const seasons = await providerRequest<{
    data: {
      league: { league_id: number; competition_name?: string; league_name?: string };
      seasons: Array<{ season_id: number; year: number; is_current?: boolean }>;
    };
  }>(`/leagues/${leagueId}/seasons`);

  const competitionName = seasons.data.league.competition_name ?? seasons.data.league.league_name;
  if (seasons.data.league.league_id !== leagueId || competitionName !== "Premier League") {
    throw new Error("Configured league ID is not the English Premier League.");
  }

  const season = [...seasons.data.seasons].sort((a, b) => b.year - a.year)[0];
  if (!season) throw new Error("No Premier League season was returned by the provider.");

  return { leagueId, seasonId: season.season_id, seasonYear: season.year };
}

async function fetchAllMatches(leagueId: number, seasonId: number) {
  const matches: ProviderMatch[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await providerRequest<ProviderPage>(
      `/leagues/${leagueId}/matches?season_id=${seasonId}&page=${page}&limit=100`,
    );
    const rawMatches = response.data?.matches ?? [];
    matches.push(...rawMatches.map((match) => providerMatchSchema.parse(match)));
    totalPages = Math.max(1, response.meta?.pagination?.total_pages ?? 1);
    page += 1;
  } while (page <= totalPages);

  return matches;
}

export function assignGameweeks(matches: ProviderMatch[]) {
  const knownGameweekByDate = new Map<string, number>();
  for (const match of matches) {
    if (match.game_week == null) continue;
    knownGameweekByDate.set(match.match_date.slice(0, 10), match.game_week);
  }

  const orderedDates = [...new Set(matches.map((match) => match.match_date.slice(0, 10)))]
    .sort((a, b) => a.localeCompare(b));
  const gameweekByDate = new Map<string, number>();
  let currentGameweek = 1;
  let previousDate: Date | null = null;

  for (const date of orderedDates) {
    const dateValue = new Date(`${date}T00:00:00Z`);
    const providerGameweek = knownGameweekByDate.get(date);
    const gapDays = previousDate
      ? (dateValue.getTime() - previousDate.getTime()) / 86_400_000
      : 0;

    if (providerGameweek != null) currentGameweek = providerGameweek;
    else if (previousDate && gapDays >= 4) currentGameweek += 1;

    gameweekByDate.set(date, currentGameweek);
    previousDate = dateValue;
  }

  return matches.map((match) => ({
    ...match,
    resolvedGameweek: gameweekByDate.get(match.match_date.slice(0, 10)) ?? null,
  }));
}

function normalizeStatus(status: string) {
  const value = status.toLowerCase();
  if (["complete", "completed", "finished"].includes(value)) return "COMPLETED";
  if (["live", "inplay", "in_progress"].includes(value)) return "LIVE";
  if (value.includes("postpon")) return "POSTPONED";
  if (value.includes("cancel")) return "CANCELLED";
  return "SCHEDULED";
}

async function syncFixtures() {
  const competition = await discoverCompetition();
  const rawMatches = await fetchAllMatches(competition.leagueId, competition.seasonId);
  const matches = assignGameweeks(rawMatches).filter((match) => match.resolvedGameweek != null);
  if (matches.length === 0) throw new Error("The provider returned no gameweek fixtures.");

  const seasonId = `footballdataIo_${competition.seasonId}`;
  const gameweekGroups = new Map<number, typeof matches>();
  const teams = new Map<number, ProviderMatch["home_team"]>();

  for (const match of matches) {
    const round = match.resolvedGameweek!;
    gameweekGroups.set(round, [...(gameweekGroups.get(round) ?? []), match]);
    teams.set(match.home_team.team_id, match.home_team);
    teams.set(match.away_team.team_id, match.away_team);
  }

  const batch = firestore.batch();
  batch.set(firestore.collection("seasons").doc(seasonId), {
    name: competition.seasonYear ? String(competition.seasonYear) : seasonId,
    providerLeagueId: competition.leagueId,
    providerSeasonId: competition.seasonId,
    providerSeasonYear: competition.seasonYear,
    isActive: true,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  for (const [providerTeamId, team] of teams) {
    batch.set(firestore.collection("teams").doc(`footballdataIo_${providerTeamId}`), {
      provider: "FOOTBALLDATA_IO",
      providerTeamId,
      name: team.team_name,
      shortName: team.team_name.split(/\s+/).map((part) => part[0]).join("").slice(0, 3).toUpperCase(),
      logoUrl: team.team_logo ?? null,
      activeSeasonIds: [seasonId],
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  for (const [roundNumber, roundMatches] of gameweekGroups) {
    const ordered = [...roundMatches].sort((a, b) => a.date_unix - b.date_unix);
    const gameweekId = `${seasonId}_gw_${roundNumber}`;
    batch.set(firestore.collection("gameweeks").doc(gameweekId), {
      seasonId,
      roundNumber,
      providerGameweek: ordered.find((match) => match.game_week != null)?.game_week ?? null,
      providerRoundId: ordered[0]?.round_id ?? null,
      startsAt: Timestamp.fromMillis(ordered[0]!.date_unix * 1000),
      endsAt: Timestamp.fromMillis(ordered.at(-1)!.date_unix * 1000),
      fixtureCount: ordered.length,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    for (const match of ordered) {
      batch.set(firestore.collection("fixtures").doc(`footballdataIo_${match.match_id}`), {
        provider: "FOOTBALLDATA_IO",
        providerMatchId: match.match_id,
        seasonId,
        gameweekId,
        roundNumber,
        homeTeam: { id: `footballdataIo_${match.home_team.team_id}`, name: match.home_team.team_name },
        awayTeam: { id: `footballdataIo_${match.away_team.team_id}`, name: match.away_team.team_name },
        kickoffAt: Timestamp.fromMillis(match.date_unix * 1000),
        providerStatus: match.status,
        normalizedStatus: normalizeStatus(match.status),
        homeScore: match.score?.home ?? null,
        awayScore: match.score?.away ?? null,
        lastSyncedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  }

  batch.set(firestore.collection("syncMetadata").doc("fixtures"), {
    seasonId,
    fixtureCount: matches.length,
    gameweekCount: gameweekGroups.size,
    synchronizedAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

export async function refreshFixturesCache() {
  await syncFixtures();
}

export async function ensureFixturesCached() {
  const metadata = await firestore.collection("syncMetadata").doc("fixtures").get();
  if (metadata.exists && Number(metadata.data()?.fixtureCount ?? 0) > 0) {
    const cachedFixture = await firestore.collection("fixtures")
      .where("seasonId", "==", metadata.data()!.seasonId)
      .limit(1)
      .get();
    if (!cachedFixture.empty) return;
  }
  fixtureSync ??= syncFixtures().finally(() => { fixtureSync = null; });
  await fixtureSync;
}

function iso(value: unknown) {
  return value instanceof Timestamp ? value.toDate().toISOString() : null;
}

export async function getFixturesForGameweek(gameweekId: string) {
  await ensureFixturesCached();
  const snapshot = await firestore.collection("fixtures").where("gameweekId", "==", gameweekId).get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data(), kickoffAt: iso(doc.data().kickoffAt) }))
    .sort((a, b) => String(a.kickoffAt).localeCompare(String(b.kickoffAt)));
}
