import { Check, LockKeyhole } from "lucide-react";
import type { PredictionFixture } from "../api";

type DraftScore = { home: string; away: string };
type Props = { fixture: PredictionFixture; draft: DraftScore; kickoff: { date: string; time: string }; onChange: (fixtureId: string, side: "home" | "away", value: string) => void };

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

export function PredictionFixtureRow({ fixture, draft, kickoff, onChange }: Props) {
  const completed = fixture.normalizedStatus === "COMPLETED" && fixture.homeScore != null && fixture.awayScore != null;
  const prediction = fixture.prediction;

  return <article className={`fixture-row prediction-row ${fixture.predictionLocked ? "is-locked" : ""}`}>
    <time dateTime={fixture.kickoffAt}><strong>{kickoff.date}</strong><span>{kickoff.time}</span></time>
    <div className="team home-team"><Crest team={fixture.homeTeam} /><strong>{fixture.homeTeam.name}</strong></div>
    <div className="prediction-cell">
      {completed ? <div className="result-comparison">
        <div><span>Final</span><strong>{fixture.homeScore}–{fixture.awayScore}</strong></div>
        <div><span>You</span><strong>{prediction ? `${prediction.predictedHomeScore}–${prediction.predictedAwayScore}` : "—"}</strong></div>
        <div className={`points-award points-${prediction?.awardedPoints ?? 0}`}><strong>{prediction?.awardedPoints ?? 0} pts</strong><span>{prediction ? pointsCopy(prediction.scoringReason) : "No prediction"}</span></div>
      </div> : fixture.predictionLocked ? <div className="locked-prediction"><LockKeyhole /><span>{prediction ? "Your pick" : "No prediction"}</span><strong>{prediction ? `${prediction.predictedHomeScore}–${prediction.predictedAwayScore}` : "—"}</strong></div> : <div className="score-entry" aria-label={`Prediction for ${fixture.homeTeam.name} against ${fixture.awayTeam.name}`}>
        <input aria-label={`${fixture.homeTeam.name} predicted score`} inputMode="numeric" min="0" max="20" type="number" value={draft.home} onChange={(event) => onChange(fixture.id, "home", event.target.value)} />
        <span>–</span>
        <input aria-label={`${fixture.awayTeam.name} predicted score`} inputMode="numeric" min="0" max="20" type="number" value={draft.away} onChange={(event) => onChange(fixture.id, "away", event.target.value)} />
        {prediction ? <Check className="saved-tick" aria-label="Saved" /> : null}
      </div>}
    </div>
    <div className="team away-team"><strong>{fixture.awayTeam.name}</strong><Crest team={fixture.awayTeam} /></div>
  </article>;
}
