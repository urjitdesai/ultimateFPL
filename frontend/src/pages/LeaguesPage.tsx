import { ArrowRight, CalendarDays, Shield, Trophy, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type League } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

const leagueIcon = { OVERALL: Trophy, TEAM_DEFAULT: Shield, GAMEWEEK_DEFAULT: CalendarDays };
const leagueLabel = { OVERALL: "Global league", TEAM_DEFAULT: "Supporters league", GAMEWEEK_DEFAULT: "Entry cohort" };

export function LeaguesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api.leagues(user).then(setLeagues).catch(() => setError("We couldn't load your leagues.")).finally(() => setLoading(false));
  }, [user]);

  if (authLoading) return <div className="loading-screen">Preparing your leagues…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  return <main className="league-page">
    <AppNav active="leagues" />
    <header className="league-hero"><span>Your competition</span><h1>Your leagues</h1><p>Every table. Every rival. One place to see where you stand.</p></header>
    <section className="league-directory">
      <div className="section-kicker"><Users /> {leagues.length} joined leagues</div>
      <div className="league-directory-head"><span>League</span><span>Type</span><span>Members</span><span /></div>
      {loading ? <div className="league-loading">Loading league tables…</div> : error ? <div className="home-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div> : leagues.map((league) => {
        const Icon = leagueIcon[league.type];
        return <button className="league-directory-row" key={league.id} onClick={() => navigate(`/leagues/${encodeURIComponent(league.id)}`)}>
          <span className="directory-league"><i><Icon /></i><span><strong>{league.name}</strong><small>View full standings</small></span></span>
          <span className="league-type">{leagueLabel[league.type]}</span>
          <span className="member-total"><strong>{league.memberCount}</strong> {league.memberCount === 1 ? "player" : "players"}</span>
          <ArrowRight />
        </button>;
      })}
    </section>
  </main>;
}
