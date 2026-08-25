import { ArrowLeft, Coins, LockKeyhole, RefreshCw, Swords, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { api, type WagerBoard } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

export function WagerLeaguePage({ leagueId }: { leagueId: string }) {
  const { user, profile, loading: authLoading } = useAuth();
  const [board, setBoard] = useState<WagerBoard | null>(null);
  const [fixtureId, setFixtureId] = useState("");
  const [stake, setStake] = useState(1);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const loadBoard = useCallback(async () => {
    if (!user) return;
    const next = await api.wagerBoard(user, leagueId);
    setBoard(next);
    setFixtureId((current) => current || next.fixtures.find((fixture) => fixture.prediction)?.id || "");
  }, [leagueId, user]);

  useEffect(() => { loadBoard().catch((requestError) => setError(requestError instanceof Error ? requestError.message : "We couldn't load the wager board.")); }, [loadBoard]);
  if (authLoading) return <div className="loading-screen">Opening wager board…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const act = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key); setError("");
    try { await action(); await loadBoard(); } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "That wager could not be updated."); }
    finally { setBusy(""); }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); if (fixtureId) void act("create", () => api.createWager(user, leagueId, fixtureId, stake)); };
  const fixtureById = new Map(board?.fixtures.map((fixture) => [fixture.id, fixture]) ?? []);

  return <main className="league-page"><AppNav active="leagues" />
    <header className="standings-hero wager-hero"><button onClick={() => navigate(`/leagues/${encodeURIComponent(leagueId)}`)}><ArrowLeft /> Back to standings</button><span>Wager league</span><h1>{board?.league.name ?? "Wager board"}</h1><p>{board?.deadline ? `Locks ${new Date(board.deadline).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Loading the gameweek deadline…"}</p></header>
    <section className="wager-content">
      {error ? <div className="home-error" role="alert">{error}<button onClick={() => void loadBoard()}><RefreshCw /> Retry</button></div> : null}
      <div className="wager-balance"><div><small>League points</small><strong>{board?.balance.totalPoints ?? 0}</strong></div><div><small>Locked in wagers</small><strong>{board?.balance.lockedPoints ?? 0}</strong></div><div><small>Available to wager</small><strong>{board?.balance.availablePoints ?? 0}</strong></div></div>
      <form className="create-wager" onSubmit={submit}><div><Coins /><span><strong>Offer a wager</strong><small>Your saved prediction is visible to challengers.</small></span></div><label><span>Fixture</span><select value={fixtureId} onChange={(event) => setFixtureId(event.target.value)}><option value="">Choose fixture</option>{board?.fixtures.filter((fixture) => fixture.prediction).map((fixture) => <option value={fixture.id} key={fixture.id}>{fixture.homeTeam.name} vs {fixture.awayTeam.name} ({fixture.prediction!.predictedHomeScore}–{fixture.prediction!.predictedAwayScore})</option>)}</select></label><label><span>Stake</span><input type="number" min="1" max="20" value={stake} onChange={(event) => setStake(Math.min(20, Math.max(1, Number(event.target.value))))} /></label><button disabled={!board?.wagersOpen || busy !== "" || !fixtureId || stake > (board?.balance.availablePoints ?? 0)}>{board?.wagersOpen ? busy === "create" ? "Offering…" : "Offer wager" : <><LockKeyhole /> Locked</>}</button></form>
      <div className="wager-section-head"><div><Swords /><span><strong>Fixture wagers</strong><small>One-to-one challenges using base prediction points.</small></span></div><span>{board?.wagers.length ?? 0} wagers</span></div>
      <div className="wager-list">{!board ? <div className="league-loading">Loading wagers…</div> : board.wagers.length === 0 ? <div className="fixture-empty"><Coins /><h3>No wagers yet</h3><p>Make the first offer for this gameweek.</p></div> : board.wagers.map((wager) => {
        const fixture = fixtureById.get(wager.fixtureId);
        return <article className="wager-row" key={wager.id}><div className="wager-fixture"><strong>{fixture ? `${fixture.homeTeam.name} vs ${fixture.awayTeam.name}` : "Completed fixture"}</strong><small>{wager.status}</small></div><div className="wager-player"><span>{wager.creatorDisplayName}</span><strong>{wager.creatorPrediction.predictedHomeScore}–{wager.creatorPrediction.predictedAwayScore}</strong></div><div className="wager-stake"><small>Stake</small><strong>{wager.stake} pts</strong></div><div className="wager-player"><span>{wager.opponentDisplayName ?? "Open challenge"}</span><strong>{wager.opponentPrediction ? `${wager.opponentPrediction.predictedHomeScore}–${wager.opponentPrediction.predictedAwayScore}` : "—"}</strong></div><div className="wager-actions">{wager.status === "OPEN" && !wager.isCreator && board.wagersOpen ? <button onClick={() => void act(wager.id, () => api.matchWager(user, leagueId, wager.id))}>Match</button> : null}{wager.isParticipant && ["OPEN", "MATCHED"].includes(wager.status) && board.wagersOpen ? <button className="cancel" aria-label="Cancel wager" onClick={() => void act(wager.id, () => api.cancelWager(user, leagueId, wager.id))}><X /></button> : null}</div></article>;
      })}</div>
    </section>
  </main>;
}
