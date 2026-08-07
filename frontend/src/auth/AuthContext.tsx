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

  useEffect(() => onAuthStateChanged(auth, async (nextUser) => {
    setUser(nextUser);
    if (!nextUser) { setProfile(null); setLoading(false); return; }
    try { setProfile(await api.profile(nextUser)); } catch { setProfile(null); }
    finally { setLoading(false); }
  }), []);

  const value = useMemo(() => ({ user, profile, loading, setProfile, logout: async () => { await signOut(auth); setProfile(null); } }), [user, profile, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
