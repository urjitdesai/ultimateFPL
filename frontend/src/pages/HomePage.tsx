import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Save, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Gameweek, type GameweekWagerView, type League, type PredictionView, type WagerSelection } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PredictionFixtureRow } from "../components/PredictionFixtureRow";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

const emptyView: PredictionView = { fixtures: [], predictionsOpen: false, captainedFixtureId: null, eligibility: { eligible: true, startsGameweek: 1 }, summary: { totalPoints: 100, gameweekPoints: 0, wagerPoints: 0, submittedCount: 0, fixtureCount: 0 } };

function formatRange(gameweek: Gameweek) {
  const start = new Date(gameweek.startsAt);
  const end = new Date(gameweek.endsAt);
  const month = new Intl.DateTimeFormat(undefined, { month: "short" });
  return `${start.getDate()} ${month.format(start)} – ${end.getDate()} ${month.format(end)}`;
}

function formatKickoff(kickoffAt: string) {
  const kickoff = new Date(kickoffAt);
  return { date: new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(kickoff), time: new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(kickoff) };
}

function formatPredictionDeadline(startsAt: string) {
  return formatKickoff(new Date(new Date(startsAt).getTime() - 3_600_000).toISOString());
}

function wagerSelectionForScore(score: { home: string; away: string }): WagerSelection | null {
  if (score.home === "" || score.away === "") return null;
  if (Number(score.home) > Number(score.away)) return "HOME_WIN";
  if (Number(score.home) < Number(score.away)) return "AWAY_WIN";
  return "DRAW";
}

export function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const favoriteTeamId = profile?.favoriteTeam.id ?? "";
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<PredictionView>(emptyView);
  const [wagerView, setWagerView] = useState<GameweekWagerView | null>(null);
  const [wagerDraft, setWagerDraft] = useState<{ fixtureId: string; selection: WagerSelection; stakePoints: number } | null>(null);
  const [wagerChanged, setWagerChanged] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { home: string; away: string }>>({});
  const [captainedFixtureId, setCaptainedFixtureId] = useState<string | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [fixtureLoading, setFixtureLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([api.gameweeks(user), api.leagues(user)]).then(([nextGameweeks, nextLeagues]) => {
      if (!active) return;
      setGameweeks(nextGameweeks);
      setLeagues(nextLeagues);
      const current = nextGameweeks.find((gameweek) => gameweek.status === "ACTIVE") ?? nextGameweeks.find((gameweek) => gameweek.status === "UPCOMING") ?? nextGameweeks.at(-1);
      setSelectedId(current?.id ?? "");
    }).catch(() => active && setError("We couldn't load matchday. Try again in a moment.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !selectedId || !favoriteTeamId) return;
    let active = true;
    setFixtureLoading(true);
    setWagerView(null);
    setWagerDraft(null);
    setWagerChanged(false);
    Promise.all([api.predictions(user, selectedId), api.gameweekWager(user, selectedId)]).then(([nextView, nextWagerView]) => {
      if (!active) return;
      setView(nextView);
      setWagerView(nextWagerView);
      setWagerDraft(null);
      setWagerChanged(false);
      const favoriteTeamFixture = nextView.fixtures.find((fixture) => !fixture.predictionLocked
        && (fixture.homeTeam.id === favoriteTeamId || fixture.awayTeam.id === favoriteTeamId));
      setCaptainedFixtureId(nextView.captainedFixtureId ?? favoriteTeamFixture?.id ?? null);
      setDrafts(Object.fromEntries(nextView.fixtures.map((fixture) => [fixture.id, fixture.prediction
        ? { home: String(fixture.prediction.predictedHomeScore), away: String(fixture.prediction.predictedAwayScore) }
        : fixture.predictionLocked
          ? { home: "", away: "" }
          : { home: "0", away: "0" }])));
      setSaved(false);
    }).catch(() => active && setError("We couldn't load predictions for that gameweek.")).finally(() => active && setFixtureLoading(false));
    return () => { active = false; };
  }, [favoriteTeamId, selectedId, user]);

  const selected = useMemo(() => gameweeks.find((gameweek) => gameweek.id === selectedId), [gameweeks, selectedId]);
  const visibleLeagues = leagues;
  const savableCount = view.fixtures.filter((fixture) => !fixture.predictionLocked && drafts[fixture.id]?.home !== "" && drafts[fixture.id]?.away !== "").length;
  const currentWagerPoints = wagerView?.wager ? Number(wagerView.wager.returnPoints ?? 0) - wagerView.wager.stakePoints : 0;
  const displayedTotal = view.summary.totalPoints;
  const displayedGameweekPoints = view.summary.gameweekPoints - view.summary.wagerPoints + currentWagerPoints;
  const existingWager = wagerView?.wager ?? null;
  const wagerHasChanges = wagerChanged && (existingWager?.status === "OPEN"
    ? wagerDraft == null || wagerDraft.fixtureId !== existingWager.fixtureId || wagerDraft.selection !== existingWager.selection || wagerDraft.stakePoints !== existingWager.stakePoints
    : existingWager == null && wagerDraft != null);
  const activeOpenWager = wagerChanged ? wagerDraft : existingWager?.status === "OPEN" ? existingWager : null;
  const wagerSubmission = activeOpenWager
    ? { fixtureId: activeOpenWager.fixtureId, stakePoints: activeOpenWager.stakePoints }
    : null;
  const replacementRefund = wagerChanged && existingWager?.status === "OPEN" && wagerDraft?.fixtureId !== existingWager.fixtureId
    ? existingWager.stakePoints
    : 0;
  const wagerDraftValid = wagerSubmission == null || (wagerSubmission.stakePoints >= 1 && wagerSubmission.stakePoints <= 20
    && wagerSubmission.stakePoints <= (wagerView?.wallet.availablePoints ?? 0) + (existingWager?.stakePoints ?? 0)
    && wagerSelectionForScore(drafts[wagerSubmission.fixtureId] ?? { home: "", away: "" }) != null);
  const hasSaveableWork = savableCount > 0 || wagerHasChanges;

  if (authLoading) return <div className="loading-screen">Preparing matchday…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const updateDraft = (fixtureId: string, side: "home" | "away", value: string) => {
    if (value !== "" && (!/^\d{1,2}$/.test(value) || Number(value) > 20)) return;
    const nextFixtureDraft = { ...(drafts[fixtureId] ?? { home: "", away: "" }), [side]: value };
    setDrafts((current) => ({ ...current, [fixtureId]: { ...(current[fixtureId] ?? { home: "", away: "" }), [side]: value } }));
    const nextSelection = wagerSelectionForScore(nextFixtureDraft);
    if (nextSelection) setWagerDraft((current) => current?.fixtureId === fixtureId ? { ...current, selection: nextSelection } : current);
    setSaved(false);
  };
  const savePredictions = async () => {
    const predictions = view.fixtures.filter((fixture) => !fixture.predictionLocked).flatMap((fixture) => {
      const draft = drafts[fixture.id];
      return draft?.home !== "" && draft?.away !== "" ? [{ fixtureId: fixture.id, predictedHomeScore: Number(draft.home), predictedAwayScore: Number(draft.away) }] : [];
    });
    if (!user || !wagerView || !hasSaveableWork || !wagerDraftValid) return;
    setSaving(true); setError("");
    try {
      const submission = await api.saveGameweekSubmission(
        user,
        selectedId,
        predictions,
        captainedFixtureId,
        wagerSubmission,
      );
      const nextView = submission.predictions;
      const nextWagerView = submission.wager;
      const nextWagerPoints = nextWagerView.wager ? Number(nextWagerView.wager.returnPoints ?? 0) - nextWagerView.wager.stakePoints : 0;
      setView({ ...nextView, summary: { ...nextView.summary, totalPoints: nextWagerView.wallet.availablePoints, gameweekPoints: nextView.summary.gameweekPoints - nextView.summary.wagerPoints + nextWagerPoints, wagerPoints: nextWagerPoints } });
      setWagerView(nextWagerView);
      setWagerDraft(null);
      setWagerChanged(false);
      setCaptainedFixtureId(nextView.captainedFixtureId);
      setSaved(true);
    }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "We couldn't save your predictions."); }
    finally { setSaving(false); }
  };
  const predictionDeadline = selected ? formatPredictionDeadline(selected.startsAt) : null;

  return <main className="home-page">
    <AppNav active="home" />

    <section className="matchday-band" id="gameweeks">
      <div className="matchday-overview"><div className="matchday-title"><h1>{selected?.status === "COMPLETE" ? `Gameweek ${selected.roundNumber} results` : view.predictionsOpen ? `Make your calls for Gameweek ${selected?.roundNumber ?? "—"}` : `Gameweek ${selected?.roundNumber ?? "—"} preview`}</h1><p><Clock3 /> {selected ? view.predictionsOpen && predictionDeadline ? `Predictions lock ${predictionDeadline.date} at ${predictionDeadline.time}` : "Predictions are locked for this gameweek" : "Loading the next round"}</p></div><div className="score-summary"><div><Trophy /><span>Total points</span><strong>{displayedTotal}</strong></div><div><span>Gameweek points</span><strong>{displayedGameweekPoints}</strong></div></div></div>
      <div className="gameweek-navigation"><button className="rail-arrow" aria-label="Earlier gameweeks" onClick={() => railRef.current?.scrollBy({ left: -420, behavior: "smooth" })}><ChevronLeft /></button><div className="gameweek-rail" ref={railRef}>{gameweeks.map((gameweek) => <button key={gameweek.id} className={gameweek.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(gameweek.id)}><strong>Gameweek {gameweek.roundNumber}</strong><span>{formatRange(gameweek)}</span></button>)}</div><button className="rail-arrow" aria-label="Later gameweeks" onClick={() => railRef.current?.scrollBy({ left: 420, behavior: "smooth" })}><ChevronRight /></button></div>
    </section>

    <section className="home-content"><div className="fixtures-section">
      <header><div><h2>{!view.eligibility.eligible ? "Before you joined" : selected?.status === "COMPLETE" ? "Your results" : view.predictionsOpen ? "Your predictions" : "Fixtures"}</h2><p>{!view.eligibility.eligible ? `Your scoring history starts in Gameweek ${view.eligibility.startsGameweek}. Earlier fixtures do not affect your points.` : selected?.status === "COMPLETE" ? "Prediction, final score and points" : view.predictionsOpen ? "Predict every match, captain one fixture, and optionally add one wager" : "Future gameweeks are available to preview only"}</p></div><div className="fixture-actions"><span className="fixture-count">{view.fixtures.length} matches</span>{view.predictionsOpen || wagerHasChanges ? <button className={`save-predictions ${saved ? "is-saved" : ""}`} disabled={saving || fixtureLoading || !hasSaveableWork || !wagerDraftValid} onClick={savePredictions}>{saved ? <Check /> : <Save />}{saving ? "Saving…" : saved ? "Saved" : "Save predictions"}</button> : null}</div></header>
      {!view.eligibility.eligible && !fixtureLoading ? <div className="eligibility-notice" role="status"><Clock3 /><div><strong>No score for this gameweek</strong><p>You joined after this gameweek's prediction deadline, so these matches are shown for reference only.</p></div></div> : null}
      {error ? <div className="home-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div> : null}
      {loading || fixtureLoading ? <div className="fixture-skeleton" aria-label="Loading fixtures">{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div> : view.fixtures.length === 0 ? <div className="fixture-empty"><CalendarDays /><h3>No fixtures yet</h3><p>This gameweek has no scheduled Premier League matches.</p></div> : <div className="fixture-list">
        <div className="fixture-head"><span>Date & time</span><span>Home</span><span>Prediction</span><span>Away</span></div>
        {view.fixtures.map((fixture) => {
          const fixtureWager = wagerView?.wager?.fixtureId === fixture.id ? wagerView.wager : null;
          const visibleFixtureWager = wagerChanged && wagerDraft?.fixtureId !== fixture.id ? null : fixtureWager;
          return <PredictionFixtureRow key={fixture.id} fixture={fixture} draft={drafts[fixture.id] ?? { home: "", away: "" }} kickoff={formatKickoff(fixture.kickoffAt)} isCaptain={captainedFixtureId === fixture.id} onChange={updateDraft} onCaptain={(fixtureId) => { setCaptainedFixtureId((current) => current === fixtureId ? null : fixtureId); setSaved(false); }} wager={visibleFixtureWager} wagerUnavailableReason={wagerView?.fixtures.find((entry) => entry.id === fixture.id)?.wagerUnavailableReason ?? null} wagerDraft={wagerDraft?.fixtureId === fixture.id ? wagerDraft : null} wagerBalance={(wagerView?.wallet.availablePoints ?? 0) + replacementRefund} wagerEligible={view.eligibility.eligible} hasOtherWager={Boolean(activeOpenWager && activeOpenWager.fixtureId !== fixture.id)} currentWagerStake={activeOpenWager?.stakePoints ?? 1} onSetWager={(next) => { setWagerDraft(next); setWagerChanged(true); setSaved(false); }} onRemoveWager={() => { setWagerDraft(null); setWagerChanged(true); setSaved(false); }} />;
        })}
      </div>}
    </div><aside className="league-rail" id="leagues"><h2>Your leagues</h2>{visibleLeagues.map((league) => <button className="league-row league-row-button" key={league.id} onClick={() => navigate(`/leagues/${encodeURIComponent(league.id)}`)}><span className="league-icon"><Users /></span><span><strong>{league.name}</strong><small>{league.memberCount} {league.memberCount === 1 ? "member" : "members"}</small></span><ArrowRight /></button>)}<button className="view-all-leagues" onClick={() => navigate("/leagues")}>View all leagues <ArrowRight /></button><div className="season-note"><CalendarDays /><div><strong>Premier League only</strong><p>Your fixtures and leagues follow the active season.</p></div></div></aside></section>
  </main>;
}
