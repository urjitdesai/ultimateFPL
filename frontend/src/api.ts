import type { User } from "firebase/auth";

const baseUrl = import.meta.env.VITE_API_BASE_URL;
export type Team = { id: string; name: string; shortName: string; logoUrl: string };
export type League = { id: string; name: string; type: "OVERALL" | "TEAM_DEFAULT" | "GAMEWEEK_DEFAULT"; memberCount: number; roundNumber?: number | null };
export type StandingEntry = { rank: number; previousRank: number; rankChange: number; userId: string; displayName: string; favoriteTeam: Team | null; totalPoints: number; gameweekPoints: number; exactScores: number; correctResults: number; isCurrentUser: boolean };
export type LeagueStandings = { league: League; currentGameweek: number; previousGameweek: number | null; standings: StandingEntry[] };
export type Profile = { uid: string; email: string; displayName: string; favoriteTeam: Team; leagues: League[]; activeSeasonId: string; joinedGameweek: number };
export type Gameweek = { id: string; seasonId: string; roundNumber: number; startsAt: string; endsAt: string; fixtureCount: number; status: "UPCOMING" | "ACTIVE" | "COMPLETE" };
export type FixtureTeam = Pick<Team, "id" | "name" | "logoUrl">;
export type Fixture = { id: string; providerMatchId: number; gameweekId: string; roundNumber: number; kickoffAt: string; normalizedStatus: string; homeTeam: FixtureTeam; awayTeam: FixtureTeam; homeScore: number | null; awayScore: number | null };
export type Prediction = { predictedHomeScore: number; predictedAwayScore: number; basePoints: number | null; awardedPoints: number | null; scoringReason: string | null; isCaptain: boolean; submittedAt: string | null; updatedAt: string | null };
export type PredictionFixture = Fixture & { prediction: Prediction | null; predictionLocked: boolean; predictionLockReason: "NOT_CURRENT_GAMEWEEK" | "KICKOFF" | null };
export type PredictionView = { fixtures: PredictionFixture[]; predictionsOpen: boolean; captainedFixtureId: string | null; summary: { totalPoints: number; gameweekPoints: number; submittedCount: number; fixtureCount: number } };

async function request<T>(path: string, init?: RequestInit, user?: User): Promise<T> {
  const token = user ? await user.getIdToken() : null;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Something went wrong.");
  return body.data as T;
}

export const api = {
  teams: () => request<Team[]>("/teams"),
  profile: (user: User) => request<Profile>("/auth/me", undefined, user),
  registerProfile: (user: User, displayName: string, favoriteTeamId: string) => request<Profile>("/auth/register-profile", { method: "POST", body: JSON.stringify({ displayName, favoriteTeamId }) }, user),
  gameweeks: (user: User) => request<Gameweek[]>("/gameweeks", undefined, user),
  fixtures: (user: User, gameweekId: string) => request<Fixture[]>(`/fixtures/gameweek/${gameweekId}`, undefined, user),
  predictions: (user: User, gameweekId: string) => request<PredictionView>(`/gameweeks/${gameweekId}/predictions/me`, undefined, user),
  savePredictions: (user: User, gameweekId: string, predictions: Array<{ fixtureId: string; predictedHomeScore: number; predictedAwayScore: number }>, captainedFixtureId: string | null) => request<PredictionView>(`/gameweeks/${gameweekId}/predictions`, { method: "PUT", body: JSON.stringify({ predictions, captainedFixtureId }) }, user),
  leagues: (user: User) => request<League[]>("/leagues", undefined, user),
  leagueStandings: (user: User, leagueId: string) => request<LeagueStandings>(`/leagues/${encodeURIComponent(leagueId)}/standings`, undefined, user)
};
