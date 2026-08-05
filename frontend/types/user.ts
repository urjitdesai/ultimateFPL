export interface User {
  id: string;
  email: string;
  display_name: string | null;
  favorite_team_id?: string | null;
  joined_gameweek?: number;
}
