import type { User } from "firebase/auth";

const baseUrl = import.meta.env.VITE_API_BASE_URL;
export type Team = { id: string; name: string; shortName: string; logoUrl: string };
export type League = { id: string; name: string; memberCount: number; inviteCode?: string | null; isDefault?: boolean; favoriteTeamId?: string | null; roundNumber?: number | null };
export type StandingEntry = { rank: number; previousRank: number; rankChange: number; userId: string; displayName: string; favoriteTeam: Team | null; totalPoints: number; gameweekPoints: number; exactScores: number; correctResults: number; scoringStartedGameweek: number; isCurrentUser: boolean };
export type LeagueStandings = { league: League; currentGameweek: number; previousGameweek: number | null; standings: StandingEntry[] };
export type PlayerPredictionFixture = Fixture & { prediction: Pick<Prediction, "predictedHomeScore" | "predictedAwayScore" | "awardedPoints" | "scoringReason" | "isCaptain"> & { isDefault: boolean } };
export type LeaguePlayerPredictions = { league: Pick<League, "id" | "name">; player: { userId: string; displayName: string; favoriteTeam: Team | null }; gameweeks: Array<{ id: string; roundNumber: number }>; selectedGameweek: { id: string; roundNumber: number } | null; eligibility: { startsGameweek: number }; fixtures: PlayerPredictionFixture[] };
export type Profile = { uid: string; email: string; displayName: string; favoriteTeam: Team; leagues: League[]; activeSeasonId: string; joinedGameweek: number };
export type Gameweek = { id: string; seasonId: string; roundNumber: number; startsAt: string; endsAt: string; fixtureCount: number; status: "UPCOMING" | "ACTIVE" | "COMPLETE" };
export type FixtureTeam = Pick<Team, "id" | "name" | "logoUrl">;
export type Fixture = { id: string; providerMatchId: number; gameweekId: string; roundNumber: number; kickoffAt: string; normalizedStatus: string; homeTeam: FixtureTeam; awayTeam: FixtureTeam; homeScore: number | null; awayScore: number | null };
export type Prediction = { predictedHomeScore: number; predictedAwayScore: number; basePoints: number | null; awardedPoints: number | null; scoringReason: string | null; isCaptain: boolean; submittedAt: string | null; updatedAt: string | null };
export type PredictionFixture = Fixture & { prediction: Prediction | null; predictionLocked: boolean; predictionLockReason: "GAMEWEEK_DEADLINE" | "NOT_ELIGIBLE" | null };
export type PredictionView = { fixtures: PredictionFixture[]; predictionsOpen: boolean; captainedFixtureId: string | null; eligibility: { eligible: boolean; startsGameweek: number }; summary: { totalPoints: number; gameweekPoints: number; wagerPoints: number; submittedCount: number; fixtureCount: number } };
export type WagerSelection = "HOME_WIN" | "DRAW" | "AWAY_WIN";
export type Wager = { id: string; fixtureId: string; gameweekId: string; roundNumber: number; selection: WagerSelection; stakePoints: number; status: "OPEN" | "WON" | "LOST"; returnPoints: number | null };
export type WagerFixture = Fixture & { wagerUnavailableReason: "TEAM_COOLDOWN" | null };
export type GameweekWagerView = { wallet: { availablePoints: number; reservedPoints: number }; wager: Wager | null; fixtures: WagerFixture[] };
export type GameweekSubmission = { predictions: PredictionView; wager: GameweekWagerView };

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
  saveGameweekSubmission: (user: User, gameweekId: string, predictions: Array<{ fixtureId: string; predictedHomeScore: number; predictedAwayScore: number }>, captainedFixtureId: string | null, wager: { fixtureId: string; stakePoints: number } | null) => request<GameweekSubmission>(`/gameweeks/${gameweekId}/submission`, { method: "PUT", body: JSON.stringify({ predictions, captainedFixtureId, wager }) }, user),
  gameweekWager: (user: User, gameweekId: string) => request<GameweekWagerView>(`/gameweeks/${gameweekId}/wager/me`, undefined, user),
  leagues: (user: User) => request<League[]>("/leagues", undefined, user),
  createLeague: (user: User, name: string) => request<League>("/leagues", { method: "POST", body: JSON.stringify({ name }) }, user),
  joinLeague: (user: User, inviteCode: string) => request<League>("/leagues/join", { method: "POST", body: JSON.stringify({ inviteCode }) }, user),
  leagueStandings: (user: User, leagueId: string) => request<LeagueStandings>(`/leagues/${encodeURIComponent(leagueId)}/standings`, undefined, user),
  leaguePlayerPredictions: (user: User, leagueId: string, memberUserId: string, gameweekId?: string) => request<LeaguePlayerPredictions>(`/leagues/${encodeURIComponent(leagueId)}/members/${encodeURIComponent(memberUserId)}/predictions${gameweekId ? `?gameweekId=${encodeURIComponent(gameweekId)}` : ""}`, undefined, user)
};
