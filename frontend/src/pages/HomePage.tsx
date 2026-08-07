import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock3, LogOut, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Fixture, type Gameweek, type League } from "../api";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../navigation";

function formatRange(gameweek: Gameweek) {
  const start = new Date(gameweek.startsAt);
  const end = new Date(gameweek.endsAt);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${start.getDate()} ${month.format(start)} – ${end.getDate()} ${month.format(end)}`;
}

function formatKickoff(kickoffAt: string) {
  const kickoff = new Date(kickoffAt);
  return {
    date: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(kickoff),
    time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(kickoff),
  };
}

function initials(name: string) {
  const words = name.split(/\s+/);
  return (words.length === 1 ? words[0].slice(0, 3) : words.map((part) => part[0]).join(""))
    .slice(0, 3)
    .toUpperCase();
}

export function HomePage() {
  const { user, profile, loading: authLoading, logout } = useAuth();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [error, setError] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([api.gameweeks(user), api.leagues(user)])
      .then(([nextGameweeks, nextLeagues]) => {
        if (!active) return;
        setGameweeks(nextGameweeks);
        setLeagues(nextLeagues);
        const current = nextGameweeks.find((gameweek) => gameweek.status === "ACTIVE")
          ?? nextGameweeks.find((gameweek) => gameweek.status === "UPCOMING")
          ?? nextGameweeks.at(-1);
        setSelectedId(current?.id ?? "");
      })
      .catch(() => active && setError("We couldn't load matchday. Try again in a moment."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId) return;
    let active = true;
    setFixtureLoading(true);
    api.fixtures(user, selectedId)
      .then((nextFixtures) => active && setFixtures(nextFixtures))
      .catch(() => active && setError("We couldn't load fixtures for that gameweek."))
      .finally(() => active && setFixtureLoading(false));
    return () => { active = false; };
  }, [selectedId, user]);

  const selected = useMemo(() => gameweeks.find((gameweek) => gameweek.id === selectedId), [gameweeks, selectedId]);
  const visibleLeagues = leagues.filter((league) => league.type === "OVERALL" || league.type === "GAMEWEEK_DEFAULT");

  if (authLoading) return <div className="loading-screen">Preparing matchday…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const scrollRail = (direction: number) => railRef.current?.scrollBy({ left: direction * 420, behavior: "smooth" });

  return <main className="home-page">
    <nav className="home-nav">
      <button className="home-brand" onClick={() => navigate("/dashboard")}><span>UF</span> Ultimate Fantasy League</button>
      <div className="home-links"><a className="active" href="/dashboard">Home</a><a href="#gameweeks">Gameweeks</a><a href="#leagues">Leagues</a></div>
      <div className="home-account"><span>Good evening, {profile.displayName}</span><button onClick={logout}><LogOut /> Log out</button></div>
    </nav>

    <section className="matchday-band" id="gameweeks">
      <div className="matchday-title"><h1>Make your calls for Gameweek {selected?.roundNumber ?? "—"}</h1><p><Clock3 /> {selected ? `First kickoff ${formatKickoff(selected.startsAt).date} at ${formatKickoff(selected.startsAt).time}` : "Loading the next round"}</p></div>
      <div className="gameweek-navigation">
        <button className="rail-arrow" aria-label="Earlier gameweeks" onClick={() => scrollRail(-1)}><ChevronLeft /></button>
        <div className="gameweek-rail" ref={railRef}>
          {gameweeks.map((gameweek) => <button key={gameweek.id} className={gameweek.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(gameweek.id)}><strong>Gameweek {gameweek.roundNumber}</strong><span>{formatRange(gameweek)}</span></button>)}
        </div>
        <button className="rail-arrow" aria-label="Later gameweeks" onClick={() => scrollRail(1)}><ChevronRight /></button>
      </div>
    </section>

    <section className="home-content">
      <div className="fixtures-section">
        <header><div><h2>Your fixtures</h2><p>All times shown locally</p></div><span className="fixture-count">{fixtures.length} matches</span></header>
        {error && <div className="home-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div>}
        {loading || fixtureLoading ? <div className="fixture-skeleton" aria-label="Loading fixtures">{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div> : fixtures.length === 0 ? <div className="fixture-empty"><CalendarDays /><h3>No fixtures yet</h3><p>This gameweek has no scheduled Premier League matches.</p></div> : <div className="fixture-list">
          <div className="fixture-head"><span>Date & time</span><span>Home</span><span>Match</span><span>Away</span></div>
          {fixtures.map((fixture) => { const kickoff = formatKickoff(fixture.kickoffAt); return <article className="fixture-row" key={fixture.id}>
            <time dateTime={fixture.kickoffAt}><strong>{kickoff.date}</strong><span>{kickoff.time}</span></time>
            <div className="team home-team"><span className="team-initials">{initials(fixture.homeTeam.name)}</span><strong>{fixture.homeTeam.name}</strong></div>
            <div className="versus">vs</div>
            <div className="team away-team"><strong>{fixture.awayTeam.name}</strong><span className="team-initials">{initials(fixture.awayTeam.name)}</span></div>
          </article>; })}
        </div>}
      </div>

      <aside className="league-rail" id="leagues">
        <h2>Your leagues</h2>
        {visibleLeagues.map((league) => <div className="league-row" key={league.id}><span className="league-icon"><Users /></span><div><strong>{league.name}</strong><p>{league.memberCount} {league.memberCount === 1 ? "member" : "members"}</p></div><ArrowRight /></div>)}
        <div className="season-note"><CalendarDays /><div><strong>Premier League only</strong><p>Your fixtures and leagues follow the active season.</p></div></div>
      </aside>
    </section>
  </main>;
}
