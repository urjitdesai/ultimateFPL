import { ArrowDown, ArrowLeft, ArrowUp, Check, ChevronLeft, ChevronRight, Copy, Minus, Shield } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, type LeagueStandings, type StandingEntry } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

function Movement({ entry }: { entry: StandingEntry }) {
  if (entry.rankChange > 0) return <span className="rank-movement up"><ArrowUp />{entry.rankChange}</span>;
  if (entry.rankChange < 0) return <span className="rank-movement down"><ArrowDown />{Math.abs(entry.rankChange)}</span>;
  return <span className="rank-movement steady"><Minus />0</span>;
}

export function LeagueStandingsPage({ leagueId }: { leagueId: string }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<LeagueStandings | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [standingsLoading, setStandingsLoading] = useState(false);
  const [requestedGameweekId, setRequestedGameweekId] = useState<string | undefined>(() =>
    new URLSearchParams(window.location.search).get("gameweekId") ?? undefined);
  const gameweekRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let timer: number | undefined;
    setError("");
    setStandingsLoading(true);
    const load = () => api.leagueStandings(user, leagueId, requestedGameweekId).then((nextData) => {
      if (!active) return;
      setData(nextData);
      if (nextData.status === "FINALIZING") timer = window.setTimeout(load, 30_000);
    }).catch((requestError) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "We couldn't load this table.");
    }).finally(() => {
      if (active) setStandingsLoading(false);
    });
    void load();
    return () => { active = false; if (timer) window.clearTimeout(timer); };
  }, [leagueId, requestedGameweekId, user]);

  useEffect(() => {
    const rail = gameweekRailRef.current;
    const selected = rail?.querySelector<HTMLElement>("[aria-pressed='true']");
    if (!rail || !selected) return;
    rail.scrollTo({
      left: selected.offsetLeft - (rail.clientWidth - selected.clientWidth) / 2,
      behavior: "smooth",
    });
  }, [data?.selectedGameweek?.id]);

  if (authLoading) return <div className="loading-screen">Building the table…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const copyLeagueCode = async () => {
    if (!data?.league.inviteCode || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(data.league.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch { setCopied(false); }
  };

  const selectGameweek = (gameweekId: string) => {
    if (gameweekId === data?.selectedGameweek?.id) return;
    const url = new URL(window.location.href);
    url.searchParams.set("gameweekId", gameweekId);
    window.history.replaceState({}, "", url);
    setRequestedGameweekId(gameweekId);
  };

  const scrollGameweeks = (direction: -1 | 1) => {
    const rail = gameweekRailRef.current;
    if (!rail) return;
    rail.scrollBy({ left: direction * Math.max(220, rail.clientWidth * 0.7), behavior: "smooth" });
  };

  return <main className="league-page">
    <AppNav active="leagues" />
    <header className="standings-hero"><button onClick={() => navigate("/leagues")}><ArrowLeft /> All leagues</button><span>League standings</span><h1>{data?.league.name ?? "Loading table"}</h1><div className="standings-hero-meta"><p>{data ? `${data.league.memberCount} competitors · ${data.currentGameweek > 0 ? `Through Gameweek ${data.currentGameweek}` : "No completed gameweeks yet"}` : "Calculating every position and movement…"}</p>{data?.league.inviteCode ? <button className="hero-league-code" onClick={copyLeagueCode}><small>League code</small><code>{data.league.inviteCode}</code>{copied ? <Check /> : <Copy />}<span>{copied ? "Copied" : "Copy"}</span></button> : null}</div></header>
    <section className="standings-content">
      {error ? <div className="home-error" role="alert">{error}<button onClick={() => navigate("/leagues")}>Back to leagues</button></div> : !data ? <div className="league-loading">Loading standings…</div> : <>
        {data.gameweeks.length > 0 ? <nav className="standings-gameweek-navigation" aria-label="League standings by gameweek">
          <button className="standings-gameweek-arrow" aria-label="Scroll to earlier gameweeks" onClick={() => scrollGameweeks(-1)}><ChevronLeft /></button>
          <div className="standings-gameweek-rail" ref={gameweekRailRef}>
            {data.gameweeks.map((gameweek) => {
              const selected = gameweek.id === data.selectedGameweek?.id;
              return <button className={`standings-gameweek-button ${selected ? "is-selected" : ""}`} aria-pressed={selected} key={gameweek.id} onClick={() => selectGameweek(gameweek.id)}>
                <span>Gameweek</span><strong>{gameweek.roundNumber}</strong>
              </button>;
            })}
          </div>
          <button className="standings-gameweek-arrow" aria-label="Scroll to later gameweeks" onClick={() => scrollGameweeks(1)}><ChevronRight /></button>
        </nav> : null}
        <div className="standings-meta"><div><Shield /><span><strong>{data.status === "FINALIZING" ? "Calculating latest standings…" : "Completed standings"}</strong><small>{data.status === "FINALIZING" ? "The last finalized table is shown and will update automatically." : "Points from the gameweek currently open for predictions are not included."}</small></span></div><span className="you-key"><i /> Your position</span></div>
        <div className={`standings-table ${standingsLoading ? "is-loading" : ""}`} aria-busy={standingsLoading}>
          <div className="standings-head"><span>Rank</span><span>Player</span><span>Movement</span><span>GW points</span><span>Total</span></div>
          {data.standings.map((entry) => <button className={`standing-row standing-row-button ${entry.isCurrentUser ? "is-you" : ""}`} key={entry.userId} onClick={() => navigate(`/leagues/${encodeURIComponent(leagueId)}/players/${encodeURIComponent(entry.userId)}`)}>
            <strong className="rank-number">{entry.rank}</strong>
            <span className="standing-player">{entry.favoriteTeam?.logoUrl ? <img src={entry.favoriteTeam.logoUrl} alt="" /> : <i>{entry.managerName.charAt(0)}</i>}<span><strong>{entry.managerName}{entry.isCurrentUser ? " (You)" : ""}</strong><small><span className="standing-user-name">{entry.userName}</span><span className="scoring-start">Scoring since Gameweek {entry.scoringStartedGameweek}</span></small></span></span>
            <Movement entry={entry} />
            <strong className="gw-points">{entry.gameweekPoints}</strong>
            <strong className="total-points">{entry.totalPoints}</strong>
          </button>)}
        </div>
      </>}
    </section>
  </main>;
}
