// Types for Fixtures
export interface FixtureData {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamId?: string | number;
  awayTeamId?: string | number;
  date: string;
  time: string;
  gameweek: number;
  status: "upcoming" | "live" | "finished";
  homeScore?: number;
  awayScore?: number;
}

// Backend API response types
export interface BackendFixture {
  id?: string;
  _id?: string;
  team_h?: number;
  team_a?: number;
  team_h_name?: string;
  homeTeam?: string;
  team_a_name?: string;
  awayTeam?: string;
  kickoff_time?: string;
  date?: string;
  event?: number;
  gameweek?: number;
  finished?: boolean;
  started?: boolean;
  team_h_score?: number;
  team_a_score?: number;
}

export interface FixturesResponse {
  fixtures: BackendFixture[];
}
