import { ArrowRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Save, Trophy, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api, type Gameweek, type League, type PredictionView } from "../api";
import { useAuth } from "../auth/AuthContext";
import { PredictionFixtureRow } from "../components/PredictionFixtureRow";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

const emptyView: PredictionView = { fixtures: [], predictionsOpen: false, captainedFixtureId: null, eligibility: { eligible: true, startsGameweek: 1 }, summary: { totalPoints: 0, gameweekPoints: 0, submittedCount: 0, fixtureCount: 0 } };

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

export function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<PredictionView>(emptyView);
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
    if (!user || !selectedId) return;
    let active = true;
    setFixtureLoading(true);
    api.predictions(user, selectedId).then((nextView) => {
      if (!active) return;
      setView(nextView);
      setCaptainedFixtureId(nextView.captainedFixtureId);
      setDrafts(Object.fromEntries(nextView.fixtures.map((fixture) => [fixture.id, { home: fixture.prediction ? String(fixture.prediction.predictedHomeScore) : "", away: fixture.prediction ? String(fixture.prediction.predictedAwayScore) : "" }])));
      setSaved(false);
    }).catch(() => active && setError("We couldn't load predictions for that gameweek.")).finally(() => active && setFixtureLoading(false));
    return () => { active = false; };
  }, [selectedId, user]);

  const selected = useMemo(() => gameweeks.find((gameweek) => gameweek.id === selectedId), [gameweeks, selectedId]);
  const visibleLeagues = leagues;
  const savableCount = view.fixtures.filter((fixture) => !fixture.predictionLocked && drafts[fixture.id]?.home !== "" && drafts[fixture.id]?.away !== "").length;

  if (authLoading) return <div className="loading-screen">Preparing matchday…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const updateDraft = (fixtureId: string, side: "home" | "away", value: string) => {
    if (value !== "" && (!/^\d{1,2}$/.test(value) || Number(value) > 20)) return;
    setDrafts((current) => ({ ...current, [fixtureId]: { ...(current[fixtureId] ?? { home: "", away: "" }), [side]: value } }));
    setSaved(false);
  };
  const savePredictions = async () => {
    const predictions = view.fixtures.filter((fixture) => !fixture.predictionLocked).flatMap((fixture) => {
      const draft = drafts[fixture.id];
      return draft?.home !== "" && draft?.away !== "" ? [{ fixtureId: fixture.id, predictedHomeScore: Number(draft.home), predictedAwayScore: Number(draft.away) }] : [];
    });
    if (!user || predictions.length === 0) return;
    setSaving(true); setError("");
    try { const nextView = await api.savePredictions(user, selectedId, predictions, captainedFixtureId); setView(nextView); setCaptainedFixtureId(nextView.captainedFixtureId); setSaved(true); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "We couldn't save your predictions."); }
    finally { setSaving(false); }
  };
  const predictionDeadline = selected ? formatPredictionDeadline(selected.startsAt) : null;

  return <main className="home-page">
    <AppNav active="home" />

    <section className="matchday-band" id="gameweeks">
      <div className="matchday-overview"><div className="matchday-title"><h1>{selected?.status === "COMPLETE" ? `Gameweek ${selected.roundNumber} results` : view.predictionsOpen ? `Make your calls for Gameweek ${selected?.roundNumber ?? "—"}` : `Gameweek ${selected?.roundNumber ?? "—"} preview`}</h1><p><Clock3 /> {selected ? view.predictionsOpen && predictionDeadline ? `Predictions lock ${predictionDeadline.date} at ${predictionDeadline.time}` : "Predictions are locked for this gameweek" : "Loading the next round"}</p></div><div className="score-summary"><div><Trophy /><span>Total points</span><strong>{view.summary.totalPoints}</strong></div><div><span>Gameweek points</span><strong>{view.summary.gameweekPoints}</strong></div></div></div>
      <div className="gameweek-navigation"><button className="rail-arrow" aria-label="Earlier gameweeks" onClick={() => railRef.current?.scrollBy({ left: -420, behavior: "smooth" })}><ChevronLeft /></button><div className="gameweek-rail" ref={railRef}>{gameweeks.map((gameweek) => <button key={gameweek.id} className={gameweek.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(gameweek.id)}><strong>Gameweek {gameweek.roundNumber}</strong><span>{formatRange(gameweek)}</span></button>)}</div><button className="rail-arrow" aria-label="Later gameweeks" onClick={() => railRef.current?.scrollBy({ left: 420, behavior: "smooth" })}><ChevronRight /></button></div>
    </section>

    <section className="home-content"><div className="fixtures-section">
      <header><div><h2>{!view.eligibility.eligible ? "Before you joined" : selected?.status === "COMPLETE" ? "Your results" : view.predictionsOpen ? "Your predictions" : "Fixtures"}</h2><p>{!view.eligibility.eligible ? `Your scoring history starts in Gameweek ${view.eligibility.startsGameweek}. Earlier fixtures do not affect your points.` : selected?.status === "COMPLETE" ? "Prediction, final score and points" : view.predictionsOpen ? "Predict every match and captain one fixture for double points" : "Future gameweeks are available to preview only"}</p></div><div className="fixture-actions"><span className="fixture-count">{view.fixtures.length} matches</span>{view.predictionsOpen ? <button className={`save-predictions ${saved ? "is-saved" : ""}`} disabled={saving || savableCount === 0} onClick={savePredictions}>{saved ? <Check /> : <Save />}{saving ? "Saving…" : saved ? "Saved" : `Save ${savableCount || ""} predictions`}</button> : null}</div></header>
      {!view.eligibility.eligible && !fixtureLoading ? <div className="eligibility-notice" role="status"><Clock3 /><div><strong>No score for this gameweek</strong><p>You joined after this gameweek's prediction deadline, so these matches are shown for reference only.</p></div></div> : null}
      {error ? <div className="home-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div> : null}
      {loading || fixtureLoading ? <div className="fixture-skeleton" aria-label="Loading fixtures">{Array.from({ length: 5 }, (_, index) => <div key={index} />)}</div> : view.fixtures.length === 0 ? <div className="fixture-empty"><CalendarDays /><h3>No fixtures yet</h3><p>This gameweek has no scheduled Premier League matches.</p></div> : <div className="fixture-list"><div className="fixture-head"><span>Date & time</span><span>Home</span><span>Prediction</span><span>Away</span></div>{view.fixtures.map((fixture) => <PredictionFixtureRow key={fixture.id} fixture={fixture} draft={drafts[fixture.id] ?? { home: "", away: "" }} kickoff={formatKickoff(fixture.kickoffAt)} isCaptain={captainedFixtureId === fixture.id} onChange={updateDraft} onCaptain={(fixtureId) => { setCaptainedFixtureId((current) => current === fixtureId ? null : fixtureId); setSaved(false); }} />)}</div>}
    </div><aside className="league-rail" id="leagues"><h2>Your leagues</h2>{visibleLeagues.map((league) => <button className="league-row league-row-button" key={league.id} onClick={() => navigate(`/leagues/${encodeURIComponent(league.id)}`)}><span className="league-icon"><Users /></span><span><strong>{league.name}</strong><small>{league.memberCount} {league.memberCount === 1 ? "member" : "members"}</small></span><ArrowRight /></button>)}<button className="view-all-leagues" onClick={() => navigate("/leagues")}>View all leagues <ArrowRight /></button><div className="season-note"><CalendarDays /><div><strong>Premier League only</strong><p>Your fixtures and leagues follow the active season.</p></div></div></aside></section>
  </main>;
}
