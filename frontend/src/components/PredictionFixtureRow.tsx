import { Coins, Crown, LockKeyhole } from "lucide-react";
import type { PredictionFixture, Wager, WagerSelection } from "../api";

type DraftScore = { home: string; away: string };
export type WagerDraft = { fixtureId: string; selection: WagerSelection; stakePoints: number };
type Props = {
  fixture: PredictionFixture;
  draft: DraftScore;
  kickoff: { date: string; time: string };
  isCaptain: boolean;
  onChange: (fixtureId: string, side: "home" | "away", value: string) => void;
  onCaptain: (fixtureId: string) => void;
  wager: Wager | null;
  wagerUnavailableReason: "TEAM_COOLDOWN" | null;
  wagerDraft: WagerDraft | null;
  wagerBalance: number;
  wagerEligible: boolean;
  hasOtherWager: boolean;
  onSetWager: (draft: WagerDraft) => void;
  onRemoveWager: () => void;
};

function initials(name: string) {
  const words = name.split(/\s+/);
  return (words.length === 1 ? words[0]!.slice(0, 3) : words.map((part) => part[0]).join("")).slice(0, 3).toUpperCase();
}

function Crest({ team }: { team: PredictionFixture["homeTeam"] }) {
  return <span className="team-crest"><img src={team.logoUrl} alt="" onError={(event) => { event.currentTarget.hidden = true; }} /><span>{initials(team.name)}</span></span>;
}

function pointsCopy(reason: string | null) {
  if (reason === "EXACT_SCORE") return "Exact score";
  if (reason === "CORRECT_GOAL_DIFFERENCE") return "Correct difference";
  if (reason === "CORRECT_RESULT") return "Correct result";
  return "No points";
}

function selectionLabel(selection: WagerSelection, fixture: PredictionFixture) {
  if (selection === "HOME_WIN") return `${fixture.homeTeam.name} win`;
  if (selection === "AWAY_WIN") return `${fixture.awayTeam.name} win`;
  return "Draw";
}

export function PredictionFixtureRow({ fixture, draft, kickoff, isCaptain, onChange, onCaptain, wager, wagerUnavailableReason, wagerDraft, wagerBalance, wagerEligible, hasOtherWager, onSetWager, onRemoveWager }: Props) {
  const completed = fixture.normalizedStatus === "COMPLETED" && fixture.homeScore != null && fixture.awayScore != null;
  const prediction = fixture.prediction;
  const wagerKickoffLocked = Date.now() >= new Date(fixture.kickoffAt).getTime();
  const wagerSettled = wager != null && wager.status !== "OPEN";
  const maxAvailableStake = wagerBalance + (wager?.status === "OPEN" ? wager.stakePoints : 0);
  const predictedSelection: WagerSelection | null = draft.home === "" || draft.away === ""
    ? null
    : Number(draft.home) > Number(draft.away)
      ? "HOME_WIN"
      : Number(draft.home) < Number(draft.away)
        ? "AWAY_WIN"
        : "DRAW";
  const canAddWager = Boolean(predictedSelection) && wagerEligible && !hasOtherWager && !wagerKickoffLocked && wagerUnavailableReason == null && maxAvailableStake >= 1;
  const wagerButtonTitle = !predictedSelection
    ? "Enter a score prediction first"
    : !wagerEligible
      ? "Wagering starts from your first eligible gameweek"
      : hasOtherWager
        ? "You already selected a wager for this gameweek"
        : wagerKickoffLocked
          ? "Wagering is closed for this fixture"
          : wagerUnavailableReason === "TEAM_COOLDOWN"
            ? "One of these teams is in your three-gameweek cooldown"
            : maxAvailableStake < 1
              ? "You do not have enough points to wager"
              : "Wager on the result of this prediction";

  return <article className={`fixture-row prediction-row ${fixture.predictionLocked ? "is-locked" : ""}`}>
    <time dateTime={fixture.kickoffAt}><strong>{kickoff.date}</strong><span>{kickoff.time}</span></time>
    <div className="team home-team"><Crest team={fixture.homeTeam} /><strong>{fixture.homeTeam.name}</strong></div>
    <div className="prediction-cell">
      {fixture.predictionLockReason === "NOT_ELIGIBLE" ? <div className="not-eligible-result"><LockKeyhole /><strong>Not eligible</strong><span>Before you joined</span></div> : completed ? <div className="completed-prediction"><div className="result-comparison">
        <div><span>Final</span><strong>{fixture.homeScore}–{fixture.awayScore}</strong></div>
        <div><span>You</span><strong>{prediction ? `${prediction.predictedHomeScore}–${prediction.predictedAwayScore}` : "—"}</strong></div>
        <div className={`points-award points-${prediction?.awardedPoints ?? 0}`}><strong>{prediction?.awardedPoints ?? 0} pts</strong><span>{prediction ? `${prediction.isCaptain ? "Captain · " : ""}${pointsCopy(prediction.scoringReason)}` : "No prediction"}</span></div>
      </div>{wagerSettled && wager ? <span className={`prediction-wager-summary ${wager.status.toLowerCase()}`}><Coins />{wager.status === "WON" ? `Won ${wager.returnPoints}` : `Lost ${wager.stakePoints}`} · {selectionLabel(wager.selection, fixture)}</span> : null}</div> : fixture.predictionLocked ? <div className="locked-prediction-wrap"><div className="locked-prediction"><LockKeyhole /><span>{prediction ? prediction.isCaptain ? "Captain pick" : "Your pick" : "Predictions closed"}</span><strong>{prediction ? `${prediction.predictedHomeScore}–${prediction.predictedAwayScore}` : "—"}</strong></div>{wager ? <span className="prediction-wager-summary"><Coins />{wager.stakePoints} pts on {selectionLabel(wager.selection, fixture)}</span> : null}</div> : <div className="prediction-editor">
        <div className="score-entry" aria-label={`Prediction for ${fixture.homeTeam.name} against ${fixture.awayTeam.name}`}><input aria-label={`${fixture.homeTeam.name} predicted score`} inputMode="numeric" min="0" max="20" type="number" value={draft.home} onChange={(event) => onChange(fixture.id, "home", event.target.value)} /><span>–</span><input aria-label={`${fixture.awayTeam.name} predicted score`} inputMode="numeric" min="0" max="20" type="number" value={draft.away} onChange={(event) => onChange(fixture.id, "away", event.target.value)} /></div>
        <div className="prediction-options"><button className={`captain-button ${isCaptain ? "is-captain" : ""}`} type="button" disabled={draft.home === "" || draft.away === ""} aria-pressed={isCaptain} onClick={() => onCaptain(fixture.id)}><Crown />Captain</button>{wagerDraft || wager ? <button className="captain-button wager-button is-wager" type="button" aria-pressed="true" title="Remove wager" onClick={onRemoveWager}><Coins />Wager</button> : <button className="captain-button wager-button" type="button" disabled={!canAddWager} aria-pressed="false" title={wagerButtonTitle} onClick={() => { if (predictedSelection) onSetWager({ fixtureId: fixture.id, selection: predictedSelection, stakePoints: 1 }); }}><Coins />Wager</button>}{wagerDraft ? <label className="wager-points-input"><input aria-label={`Points to wager on ${fixture.homeTeam.name} versus ${fixture.awayTeam.name}`} type="number" inputMode="numeric" min="1" max={Math.min(20, maxAvailableStake)} value={wagerDraft.stakePoints} onChange={(event) => { const stakePoints = Math.min(20, Math.max(1, Number(event.target.value))); onSetWager({ fixtureId: fixture.id, selection: predictedSelection ?? wagerDraft.selection, stakePoints }); }} /><span>pts</span></label> : wager ? <span className="wager-points-value">{wager.stakePoints} pts</span> : null}</div>
      </div>}
    </div>
    <div className="team away-team"><strong>{fixture.awayTeam.name}</strong><Crest team={fixture.awayTeam} /></div>
  </article>;
}
