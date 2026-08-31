import type { User } from "firebase/auth";
import { api, ApiError, type Profile } from "../api";

export type GoogleProfileLookup =
  | { kind: "existing"; profile: Profile }
  | { kind: "missing" };

export async function lookupGoogleProfile(user: User): Promise<GoogleProfileLookup> {
  try {
    return { kind: "existing", profile: await api.profile(user) };
  } catch (error) {
    if (error instanceof ApiError && error.code === "PROFILE_NOT_FOUND") return { kind: "missing" };
    throw error;
  }
}
