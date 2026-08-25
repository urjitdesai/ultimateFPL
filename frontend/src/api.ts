import type { User } from "firebase/auth";

const baseUrl = import.meta.env.VITE_API_BASE_URL;
export type Team = { id: string; name: string; shortName: string; logoUrl: string };
export type League = { id: string; name: string; memberCount: number; inviteCode?: string | null };
export type StandingEntry = { rank: number; previousRank: number; rankChange: number; userId: string; displayName: string; favoriteTeam: Team | null; totalPoints: number; gameweekPoints: number; exactScores: number; correctResults: number; isCurrentUser: boolean };
export type LeagueStandings = { league: League; currentGameweek: number; previousGameweek: number | null; standings: StandingEntry[] };
export type Wallet = { availablePoints: number; reservedPoints: number; lifetimePointsStaked: number; lifetimePointsReturned: number };
export type Profile = { uid: string; email: string; displayName: string; leagues: League[]; wallet: Wallet; activeSeasonId: string; joinedGameweek: number };
export type Gameweek = { id: string; seasonId: string; roundNumber: number; startsAt: string; endsAt: string; fixtureCount: number; status: "UPCOMING" | "ACTIVE" | "COMPLETE" };
export type FixtureTeam = Pick<Team, "id" | "name" | "logoUrl">;
export type Fixture = { id: string; providerMatchId: number; gameweekId: string; roundNumber: number; kickoffAt: string; normalizedStatus: string; homeTeam: FixtureTeam; awayTeam: FixtureTeam; homeScore: number | null; awayScore: number | null };
export type WagerSelection = "HOME_WIN" | "DRAW" | "AWAY_WIN";
export type Wager = { id: string; fixtureId: string; gameweekId: string; selection: WagerSelection; stakePoints: number; status: "OPEN" | "WON" | "LOST" | "VOID"; returnPoints: number | null; netPoints: number | null };
export type GameweekWagers = { wallet: Wallet; fixtures: Array<Fixture & { wager: Wager | null }> };

async function request<T>(path: string, init?: RequestInit, user?: User): Promise<T> {
  const token = user ? await user.getIdToken() : null;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}), ...init?.headers } });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? "Something went wrong.");
  return body.data as T;
}

export const api = {
  teams: () => request<Team[]>("/teams"),
  profile: (user: User) => request<Profile>("/auth/me", undefined, user),
  registerProfile: (user: User, displayName: string) => request<Profile>("/auth/register-profile", { method: "POST", body: JSON.stringify({ displayName }) }, user),
  gameweeks: (user: User) => request<Gameweek[]>("/gameweeks", undefined, user),
  fixtures: (user: User, gameweekId: string) => request<Fixture[]>(`/fixtures/gameweek/${gameweekId}`, undefined, user),
  leagues: (user: User) => request<League[]>("/leagues", undefined, user),
  createLeague: (user: User, name: string) => request<League>("/leagues", { method: "POST", body: JSON.stringify({ name }) }, user),
  joinLeague: (user: User, inviteCode: string) => request<League>("/leagues/join", { method: "POST", body: JSON.stringify({ inviteCode }) }, user),
  leagueStandings: (user: User, leagueId: string) => request<LeagueStandings>(`/leagues/${encodeURIComponent(leagueId)}/standings`, undefined, user),
  wallet: (user: User) => request<Wallet>("/wallet", undefined, user),
  gameweekWagers: (user: User, gameweekId: string) => request<GameweekWagers>(`/gameweeks/${encodeURIComponent(gameweekId)}/wagers/me`, undefined, user),
  saveWager: (user: User, fixtureId: string, selection: WagerSelection, stakePoints: number) => request<Wager>(`/fixtures/${encodeURIComponent(fixtureId)}/wager`, { method: "PUT", body: JSON.stringify({ selection, stakePoints }) }, user),
  deleteWager: (user: User, fixtureId: string) => request<void>(`/fixtures/${encodeURIComponent(fixtureId)}/wager`, { method: "DELETE" }, user)
};
