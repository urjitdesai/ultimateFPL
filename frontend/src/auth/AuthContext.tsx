import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type Profile } from "../api";
import { auth } from "../firebase/client";

type AuthValue = { user: User | null; profile: Profile | null; loading: boolean; setProfile: (profile: Profile | null) => void; logout: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let currentUid: string | null = null;
    return onAuthStateChanged(auth, async (nextUser) => {
      currentUid = nextUser?.uid ?? null;
      const requestedUid = currentUid;
      setUser(nextUser);
      setProfile(null);
      if (!nextUser) { setLoading(false); return; }
      setLoading(true);
      try {
        const nextProfile = await api.profile(nextUser);
        if (currentUid === requestedUid) setProfile(nextProfile);
      } catch {
        if (currentUid === requestedUid) setProfile(null);
      } finally {
        if (currentUid === requestedUid) setLoading(false);
      }
    });
  }, []);

  const value = useMemo(() => ({ user, profile, loading, setProfile, logout: async () => { await signOut(auth); setProfile(null); } }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
