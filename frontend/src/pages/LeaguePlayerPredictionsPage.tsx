import { ArrowLeft, CalendarDays, Coins, Crown, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type LeaguePlayerPredictions } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";
import { playerGameweekPoints, playerWagerResultLabel, playerWagerSelectionLabel } from "../player-wager";

function resultLabel(reason: string | null, isDefault: boolean) {
  if (isDefault) return null;
  if (reason === "EXACT_SCORE") return "Exact score";
  if (reason === "CORRECT_GOAL_DIFFERENCE") return "Correct goal difference";
  if (reason === "CORRECT_RESULT") return "Correct result";
  return "Incorrect result";
}

function signedPoints(points: number) {
  return points > 0 ? `+${points}` : String(points);
}

export function LeaguePlayerPredictionsPage({ leagueId, memberUserId }: { leagueId: string; memberUserId: string }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [data, setData] = useState<LeaguePlayerPredictions | null>(null);
  const [gameweekId, setGameweekId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoading(true);
    setError("");
    api.leaguePlayerPredictions(user, leagueId, memberUserId, gameweekId || undefined)
      .then((nextData) => { if (active) { setData(nextData); setGameweekId(nextData.selectedGameweek?.id ?? ""); } })
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : "We couldn't load these predictions."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [gameweekId, leagueId, memberUserId, user]);

  if (authLoading) return <div className="loading-screen">Loading player predictions…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const points = playerGameweekPoints(
    data?.fixtures.reduce((sum, fixture) => sum + Number(fixture.prediction.awardedPoints ?? 0), 0) ?? 0,
    data?.wager ?? null,
  );
  return <main className="league-page">
    <AppNav active="leagues" />
    <header className="standings-hero player-predictions-hero">
      <button onClick={() => navigate(`/leagues/${encodeURIComponent(leagueId)}`)}><ArrowLeft /> Back to standings</button>
      <div className="player-hero-layout">
        <div className="player-hero-copy">
          <span>Player predictions</span>
          <h1>{data?.player.managerName ?? "Loading player"}</h1>
          <p>{data ? `${data.player.userName} · ${data.league.name} · Gameweek ${data.selectedGameweek?.roundNumber ?? "—"}` : "Loading completed predictions…"}</p>
        </div>
        {data?.selectedGameweek ? <div className="player-score-summary" aria-label={`Gameweek ${data.selectedGameweek.roundNumber} points breakdown`}>
          <div><span>Prediction points</span><strong>{points.predictionPoints}</strong></div>
          <div className={points.wagerPoints > 0 ? "is-positive" : points.wagerPoints < 0 ? "is-negative" : ""}><Coins /><span>Wager points</span><strong>{signedPoints(points.wagerPoints)}</strong></div>
          <div className="player-score-total"><Trophy /><span>Gameweek total</span><strong>{points.totalPoints}</strong></div>
        </div> : null}
      </div>
    </header>
    <section className="player-predictions-content">
      <div className="player-results-toolbar">
        <div><h2>Gameweek {data?.selectedGameweek?.roundNumber ?? "—"} results</h2><p>Prediction, final score and points earned</p></div>
        {data?.gameweeks.length ? <label className="gameweek-picker"><CalendarDays /><span>Gameweek</span><select value={gameweekId} onChange={(event) => setGameweekId(event.target.value)}>{data.gameweeks.map((gameweek) => <option value={gameweek.id} key={gameweek.id}>Gameweek {gameweek.roundNumber}</option>)}</select></label> : null}
      </div>
      {data ? <div className="eligibility-notice compact" role="status"><CalendarDays /><div><strong>Scoring started in Gameweek {data.eligibility.startsGameweek}</strong><p>Earlier gameweeks are excluded because this player had not joined the league yet.</p></div></div> : null}
      {error ? <div className="home-error" role="alert">{error}</div> : loading ? <div className="league-loading">Loading predictions…</div> : !data?.selectedGameweek ? <div className="fixture-empty"><CalendarDays /><h3>No eligible completed gameweeks</h3><p>This player's history will appear after an eligible gameweek is completed.</p></div> : <div className="player-prediction-list">
        <div className="player-prediction-head"><span>Fixture</span><span>Prediction</span><span>Actual</span><span>Points</span></div>
        {data.fixtures.map((fixture) => {
          const fixtureWager = data.wager?.fixtureId === fixture.id ? data.wager : null;
          const predictionResult = resultLabel(fixture.prediction.scoringReason, fixture.prediction.isDefault);
          return <article className={`player-prediction-row ${fixtureWager ? `has-wager wager-${fixtureWager.status.toLowerCase()}` : ""}`} key={fixture.id}>
          <div className="player-fixture"><div className="player-team-pair"><span><img src={fixture.homeTeam.logoUrl} alt="" />{fixture.homeTeam.name}</span><span><img src={fixture.awayTeam.logoUrl} alt="" />{fixture.awayTeam.name}</span></div>{fixtureWager ? <div className={`player-wager-summary ${fixtureWager.status.toLowerCase()}`}><Coins /><div><strong>{fixtureWager.stakePoints} pt wager · {playerWagerSelectionLabel(fixtureWager, fixture)}</strong><small>{playerWagerResultLabel(fixtureWager)}</small></div></div> : null}</div>
          <div className="player-score-cell"><span>Prediction</span><strong>{fixture.prediction.predictedHomeScore}–{fixture.prediction.predictedAwayScore}{fixture.prediction.isCaptain ? <Crown aria-label="Captain" /> : null}</strong></div>
          <div className="player-score-cell"><span>Actual</span><strong>{fixture.homeScore}–{fixture.awayScore}</strong></div>
          <span className={`player-points ${Number(fixture.prediction.awardedPoints) > 0 ? "earned" : ""}`}><span>Points</span><strong>{fixture.prediction.awardedPoints ?? 0} pts</strong>{predictionResult ? <small>{predictionResult}</small> : null}</span>
        </article>})}
      </div>}
    </section>
  </main>;
}
