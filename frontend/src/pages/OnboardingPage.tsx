import { ArrowLeft, ArrowRight, Check, Clock3, Coins, Crown, Info, Save, Trophy, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { completeOnboarding } from "../auth/onboarding-state";
import { useAuth } from "../auth/AuthContext";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { navigate } from "../navigation";

const lessons = [
  { title: "How to play", shortTitle: "How to play" },
  { title: "Scoring", shortTitle: "Scoring" },
  { title: "Ready to play", shortTitle: "Final tips" },
] as const;

const scoringExamples = [
  { label: "Exact score", predicted: "2–1", final: "2–1", points: 5, tone: "exact" },
  { label: "Correct goal difference", predicted: "2–0", final: "3–1", points: 3, tone: "close" },
  { label: "Correct result", predicted: "2–1", final: "3–1", points: 2, tone: "close" },
  { label: "Incorrect result", predicted: "1–0", final: "1–2", points: 0, tone: "miss" },
] as const;

function LessonProgress({ step, managerName, onSelect }: { step: number; managerName: string; onSelect: (step: number) => void }) {
  return <>
    <div className="guide-mobile-progress">
      <span><strong>{step + 1} of 3</strong> · {lessons[step]!.shortTitle}</span>
      <div role="progressbar" aria-label="Guide progress" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1}><span style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>
    </div>
    <aside className="guide-lesson-rail" aria-label="Guide lessons">
      <p>Welcome, {managerName}.</p>
      <ol>{lessons.map((lesson, index) => {
        const state = index < step ? "complete" : index === step ? "current" : "upcoming";
        return <li className={`is-${state}`} key={lesson.title}>
          <button type="button" onClick={() => onSelect(index)} aria-current={index === step ? "step" : undefined}>
            <span className="guide-step-number">{index < step ? <Check /> : index + 1}</span>
            <span><strong>{lesson.title}</strong><small>{state === "complete" ? "Complete" : state === "current" ? "In progress" : "Upcoming"}</small></span>
          </button>
        </li>;
      })}</ol>
      <div className="guide-revisit-note"><Info /><span>You can revisit this guide anytime from How to play.</span></div>
    </aside>
  </>;
}

function HowToPlayLesson() {
  const [homeScore, setHomeScore] = useState(2);
  const [awayScore, setAwayScore] = useState(1);
  const [captain, setCaptain] = useState(true);
  return <div className="guide-lesson guide-how-to-play">
    <header><h1>Make your call before kickoff.</h1><p>Predict every Premier League score, choose one captain fixture, then save before predictions lock.</p></header>
    <div className="guide-demo-fixture" aria-label="Example score prediction">
      <div className="guide-demo-team"><span>ARS</span><strong>Arsenal</strong></div>
      <div className="guide-demo-editor">
        <span>YOUR PREDICTION</span>
        <div><input aria-label="Example Arsenal score" type="number" min="0" max="20" value={homeScore} onChange={(event) => setHomeScore(Math.min(20, Math.max(0, Number(event.target.value))))} /><i>–</i><input aria-label="Example Chelsea score" type="number" min="0" max="20" value={awayScore} onChange={(event) => setAwayScore(Math.min(20, Math.max(0, Number(event.target.value))))} /></div>
        <button className={captain ? "is-selected" : ""} type="button" aria-pressed={captain} onClick={() => setCaptain((current) => !current)}><Crown /> Captain</button>
      </div>
      <div className="guide-demo-team is-away"><span>CHE</span><strong>Chelsea</strong></div>
    </div>
    <div className="guide-play-rules">
      <div><span><Clock3 /></span><strong>Predict every match</strong><p>Enter a score before the gameweek deadline.</p></div>
      <div><span><Crown /></span><strong>Captain one fixture</strong><p>That prediction earns double points.</p></div>
      <div><span><Save /></span><strong>Save your calls</strong><p>You can edit unlocked fixtures and save again.</p></div>
    </div>
  </div>;
}

function ScoringLesson() {
  const [captainBoost, setCaptainBoost] = useState(true);
  return <div className="guide-lesson guide-scoring">
    <header><h1>Every prediction can earn points.</h1><p>The closer your call, the more you score. Your captain fixture scores double.</p></header>
    <div className="guide-score-table">
      <div className="guide-score-head"><span>Example</span><span>Predicted</span><span>Final</span><span>Points earned</span></div>
      {scoringExamples.map((example, index) => <div className={`guide-score-row is-${example.tone}`} key={example.label}>
        <span className="guide-score-label"><i>{index + 1}</i><strong>{example.label}</strong></span>
        <strong className="guide-score-value">{example.predicted}</strong>
        <ArrowRight className="guide-score-arrow" aria-hidden="true" />
        <strong className="guide-score-value">{example.final}</strong>
        <strong className="guide-points-value">{example.points} PTS</strong>
      </div>)}
    </div>
    <button className={`guide-captain-strip ${captainBoost ? "is-active" : ""}`} type="button" aria-pressed={captainBoost} onClick={() => setCaptainBoost((current) => !current)}>
      <span className="guide-captain-icon"><Crown /></span><span><strong>Captain one fixture each gameweek</strong><small>Its prediction points are doubled.</small></span><span className="guide-captain-math"><i>5 PTS</i><ArrowRight /><strong>{captainBoost ? "10 PTS" : "5 PTS"}</strong></span>
    </button>
  </div>;
}

function FinalTipsLesson() {
  const [stake, setStake] = useState(10);
  const [won, setWon] = useState(true);
  return <div className="guide-lesson guide-final-tips">
    <header><h1>Start with 100 points. Build from there.</h1><p>Prediction points grow your total. Wagers are optional—and they use points you already have.</p></header>
    <div className="guide-final-layout">
      <section className="guide-wager-demo">
        <div className="guide-balance"><span><Trophy /> Starting total</span><strong>100</strong><small>points</small></div>
        <div className="guide-wager-controls">
          <span className="guide-section-label">Optional wager calculator</span>
          <div className="guide-outcome-switch" aria-label="Example wager outcome"><button className={won ? "is-selected" : ""} type="button" onClick={() => setWon(true)}>If you win</button><button className={!won ? "is-selected" : ""} type="button" onClick={() => setWon(false)}>If you miss</button></div>
          <label>Stake <strong>{stake} points</strong><input type="range" min="1" max="20" value={stake} onChange={(event) => setStake(Number(event.target.value))} /></label>
          <div className="guide-wager-result"><Coins /><span>{won ? "Returned to your total" : "Removed from your total"}</span><strong>{won ? `+${stake * 2}` : `−${stake}`} pts</strong></div>
        </div>
      </section>
      <section className="guide-matchday-checklist">
        <span className="guide-section-label">Your gameweek rhythm</span>
        <ol>
          <li><span>1</span><div><strong>Predict every fixture</strong><p>Closer scores earn more points.</p></div></li>
          <li><span>2</span><div><strong>Pick one captain</strong><p>Its prediction points double.</p></div></li>
          <li><span>3</span><div><strong>Choose an optional wager</strong><p>Stake 1–20 points on one predicted outcome. A win returns 2× your stake.</p></div></li>
          <li><span>4</span><div><strong>Save before the deadline</strong><p>Your leagues update after results settle.</p></div></li>
        </ol>
        <div className="guide-cooldown-note"><Users /><p><strong>One last wager rule</strong><span>After backing a fixture, both clubs enter a three-gameweek cooldown.</span></p></div>
      </section>
    </div>
  </div>;
}

export function OnboardingPage() {
  const [step, setStep] = useState(0);
  const { user, profile, loading } = useAuth();
  const headingRegion = useRef<HTMLDivElement>(null);
  const isDevelopmentPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).has("preview");

  useEffect(() => {
    if (!isDevelopmentPreview && !loading && (!user || !profile)) navigate("/login", true);
  }, [isDevelopmentPreview, loading, profile, user]);

  useEffect(() => {
    headingRegion.current?.focus();
  }, [step]);

  if (!isDevelopmentPreview && (loading || !user || !profile)) return <div className="loading-screen"><LoadingIndicator label="Preparing your guide…" /></div>;

  const leaveGuide = () => {
    if (user) completeOnboarding(user.uid);
    navigate(user ? "/dashboard" : "/login", true);
  };
  const next = () => step === lessons.length - 1 ? leaveGuide() : setStep((current) => current + 1);

  return <main className="guide-page">
    <header className="guide-topbar"><button className="guide-brand" type="button" onClick={() => navigate("/dashboard")}><span>UF</span><strong>Ultimate Fantasy League</strong></button><div><span><Clock3 /> 2 min guide</span><button type="button" onClick={leaveGuide}>Skip for now</button></div></header>
    <div className="guide-shell">
      <LessonProgress step={step} managerName={profile?.managerName ?? "manager"} onSelect={setStep} />
      <section className="guide-stage" aria-live="polite">
        <div className="guide-stage-body" ref={headingRegion} tabIndex={-1}>
          {step === 0 ? <HowToPlayLesson /> : step === 1 ? <ScoringLesson /> : <FinalTipsLesson />}
        </div>
        <footer className="guide-actions">
          <button className="guide-back" type="button" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}><ArrowLeft /> Back</button>
          <div className="guide-dots" aria-hidden="true">{lessons.map((lesson, index) => <i className={index === step ? "is-active" : ""} key={lesson.title} />)}<span>{step + 1} of 3</span></div>
          <button className="guide-next" type="button" onClick={next}><span className="guide-next-long">{step === lessons.length - 1 ? "Start playing" : step === 1 ? "Next: final tips" : "Next: scoring"}</span><span className="guide-next-short">{step === lessons.length - 1 ? "Start playing" : "Next"}</span><ArrowRight /></button>
        </footer>
      </section>
    </div>
  </main>;
}
