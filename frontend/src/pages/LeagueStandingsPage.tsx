import { ArrowDown, ArrowLeft, ArrowUp, Check, Copy, Minus, Shield } from "lucide-react";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!user) return;
    setError("");
    api.leagueStandings(user, leagueId).then(setData).catch((requestError) => setError(requestError instanceof Error ? requestError.message : "We couldn't load this table."));
  }, [leagueId, user]);

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

  return <main className="league-page">
    <AppNav active="leagues" />
    <header className="standings-hero"><button onClick={() => navigate("/leagues")}><ArrowLeft /> All leagues</button><span>League standings</span><h1>{data?.league.name ?? "Loading table"}</h1><div className="standings-hero-meta"><p>{data ? `${data.league.memberCount} competitors · Through Gameweek ${data.currentGameweek}` : "Calculating every position and movement…"}</p>{data?.league.inviteCode ? <button className="hero-league-code" onClick={copyLeagueCode}><small>League code</small><code>{data.league.inviteCode}</code>{copied ? <Check /> : <Copy />}<span>{copied ? "Copied" : "Copy"}</span></button> : null}</div></header>
    <section className="standings-content">
      {error ? <div className="home-error" role="alert">{error}<button onClick={() => navigate("/leagues")}>Back to leagues</button></div> : !data ? <div className="league-loading">Loading standings…</div> : <>
        <div className="standings-meta"><div><Shield /><span><strong>Current table</strong><small>Rank movement compares with Gameweek {data.previousGameweek ?? "—"}</small></span></div><span className="you-key"><i /> Your position</span></div>
        <div className="standings-table">
          <div className="standings-head"><span>Rank</span><span>Player</span><span>Movement</span><span>GW points</span><span>Total</span></div>
          {data.standings.map((entry) => <button className={`standing-row standing-row-button ${entry.isCurrentUser ? "is-you" : ""}`} key={entry.userId} onClick={() => navigate(`/leagues/${encodeURIComponent(leagueId)}/players/${encodeURIComponent(entry.userId)}`)}>
            <strong className="rank-number">{entry.rank}</strong>
            <span className="standing-player">{entry.favoriteTeam?.logoUrl ? <img src={entry.favoriteTeam.logoUrl} alt="" /> : <i>{entry.displayName.charAt(0)}</i>}<span><strong>{entry.displayName}{entry.isCurrentUser ? " (You)" : ""}</strong><small>{entry.favoriteTeam?.name ?? "Premier League player"}</small></span></span>
            <Movement entry={entry} />
            <strong className="gw-points">{entry.gameweekPoints}</strong>
            <strong className="total-points">{entry.totalPoints}</strong>
          </button>)}
        </div>
      </>}
    </section>
  </main>;
}
