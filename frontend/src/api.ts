import type { User } from "firebase/auth";

const baseUrl = import.meta.env.VITE_API_BASE_URL;
export type Team = { id: string; name: string; shortName: string };
export type Profile = { uid: string; email: string; displayName: string; favoriteTeam: Team; league: { id: string; name: string; type: "TEAM_DEFAULT" }; seasonId: string };

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
  registerProfile: (user: User, displayName: string, favoriteTeamId: string) => request<Profile>("/auth/register-profile", { method: "POST", body: JSON.stringify({ displayName, favoriteTeamId }) }, user)
};
