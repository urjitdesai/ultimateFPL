import { ArrowRight, CheckCircle2, LogOut, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../navigation";

export function DashboardPage() {
  const { profile, loading, logout } = useAuth();
  if (loading) return <div className="loading-screen">Preparing matchday…</div>;
  if (!profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }
  return <main className="welcome-page"><nav><strong>Ultimate Fantasy League</strong><button onClick={logout}><LogOut /> Log out</button></nav><section className="welcome-content"><CheckCircle2 className="success-icon" /><p className="welcome-kicker">You’re in, {profile.displayName}.</p><h1>Welcome to the<br /><span>{profile.league.name}</span> league.</h1><p className="welcome-lead">Your club is locked in and your place in the supporters’ table is ready. Predictions arrive in the next build.</p><div className="membership-strip"><span className="team-monogram">{profile.favoriteTeam.shortName}</span><div><strong>{profile.league.name}</strong><p><Users /> Default supporters league · {profile.seasonId}</p></div><ArrowRight /></div></section></main>;
}
