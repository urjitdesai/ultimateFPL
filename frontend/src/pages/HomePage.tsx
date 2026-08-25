import { CalendarDays, Coins, Save, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, type Gameweek, type GameweekWagers, type WagerSelection } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

type Draft = { selection: WagerSelection; stakePoints: number };
const outcomes: Array<{ value: WagerSelection; label: string }> = [
  { value: "HOME_WIN", label: "Home win" },
  { value: "DRAW", label: "Draw" },
  { value: "AWAY_WIN", label: "Away win" },
];

export function HomePage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [view, setView] = useState<GameweekWagers | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    api.gameweeks(user).then((items) => {
      setGameweeks(items);
      setSelectedId((items.find((gameweek) => gameweek.status === "ACTIVE") ?? items.find((gameweek) => gameweek.status === "UPCOMING") ?? items.at(-1))?.id ?? "");
    }).catch(() => setError("We couldn't load the gameweeks."));
  }, [user]);

  const load = async () => {
    if (!user || !selectedId) return;
    const next = await api.gameweekWagers(user, selectedId);
    setView(next);
    setDrafts(Object.fromEntries(next.fixtures.map((fixture) => [fixture.id, {
      selection: fixture.wager?.selection ?? "HOME_WIN",
      stakePoints: fixture.wager?.stakePoints ?? 1,
    }])));
  };

  useEffect(() => { load().catch(() => setError("We couldn't load wagers for that gameweek.")); }, [selectedId, user]);
  const selected = useMemo(() => gameweeks.find((gameweek) => gameweek.id === selectedId), [gameweeks, selectedId]);

  if (authLoading) return <div className="loading-screen">Preparing matchday…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  const save = async (fixtureId: string) => {
    const draft = drafts[fixtureId];
    if (!draft) return;
    setBusy(fixtureId); setError("");
    try { await api.saveWager(user, fixtureId, draft.selection, draft.stakePoints); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The wager could not be saved."); }
    finally { setBusy(""); }
  };
  const remove = async (fixtureId: string) => {
    setBusy(fixtureId); setError("");
    try { await api.deleteWager(user, fixtureId); await load(); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : "The wager could not be removed."); }
    finally { setBusy(""); }
  };

  return <main className="home-page"><AppNav active="home" />
    <section className="matchday-band"><div className="matchday-overview"><div className="matchday-title"><h1>Gameweek {selected?.roundNumber ?? "—"} wagers</h1><p><CalendarDays /> Pick the result before each fixture kicks off.</p></div><div className="score-summary"><div><Coins /><span>Available</span><strong>{view?.wallet.availablePoints ?? profile.wallet?.availablePoints ?? 0}</strong></div><div><span>Reserved</span><strong>{view?.wallet.reservedPoints ?? profile.wallet?.reservedPoints ?? 0}</strong></div></div></div>
      <div className="gameweek-navigation"><div className="gameweek-rail">{gameweeks.map((gameweek) => <button key={gameweek.id} className={gameweek.id === selectedId ? "selected" : ""} onClick={() => setSelectedId(gameweek.id)}><strong>Gameweek {gameweek.roundNumber}</strong><span>{gameweek.status}</span></button>)}</div></div>
    </section>
    <section className="home-content"><div className="fixtures-section"><header><div><h2>Choose an outcome</h2><p>Stake 1–20 points. Correct wagers return double; incorrect wagers return zero.</p></div></header>
      {error ? <div className="home-error" role="alert">{error}</div> : null}
      {!view ? <div className="fixture-skeleton"><div /><div /><div /></div> : view.fixtures.length === 0 ? <div className="fixture-empty"><CalendarDays /><h3>No fixtures</h3></div> : <div className="wager-list">{view.fixtures.map((fixture) => {
        const draft = drafts[fixture.id] ?? { selection: "HOME_WIN" as const, stakePoints: 1 };
        const locked = Date.now() >= new Date(fixture.kickoffAt).getTime() || fixture.wager?.status !== "OPEN" && fixture.wager != null;
        return <article className="wager-row" key={fixture.id}><div className="wager-fixture"><strong>{fixture.homeTeam.name} vs {fixture.awayTeam.name}</strong><small>{new Date(fixture.kickoffAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</small></div><label><span>Outcome</span><select disabled={locked} value={draft.selection} onChange={(event) => setDrafts((current) => ({ ...current, [fixture.id]: { ...draft, selection: event.target.value as WagerSelection } }))}>{outcomes.map((outcome) => <option key={outcome.value} value={outcome.value}>{outcome.label}</option>)}</select></label><label><span>Stake</span><input disabled={locked} type="number" min="1" max="20" value={draft.stakePoints} onChange={(event) => setDrafts((current) => ({ ...current, [fixture.id]: { ...draft, stakePoints: Math.min(20, Math.max(1, Number(event.target.value))) } }))} /></label><div className="wager-actions"><button disabled={locked || busy === fixture.id || draft.stakePoints > view.wallet.availablePoints + (fixture.wager?.stakePoints ?? 0)} onClick={() => void save(fixture.id)}><Save /> {fixture.wager ? "Update" : "Wager"}</button>{fixture.wager?.status === "OPEN" && !locked ? <button className="cancel" aria-label="Delete wager" onClick={() => void remove(fixture.id)}><Trash2 /></button> : null}</div>{fixture.wager ? <div className="wager-stake"><small>{fixture.wager.status}</small><strong>{fixture.wager.returnPoints == null ? `${fixture.wager.stakePoints} pts` : `${fixture.wager.returnPoints} returned`}</strong></div> : null}</article>;
      })}</div>}
    </div></section>
  </main>;
}
