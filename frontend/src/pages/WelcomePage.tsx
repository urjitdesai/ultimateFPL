import { ArrowRight, BarChart3, Check, Target, Trophy } from "lucide-react";
import { APP_NAME } from "../brand";
import { BrandLogo } from "../components/BrandLogo";
import { navigate } from "../navigation";

export function WelcomePage() {
  return <main className="welcome-page">
    <div className="welcome-glow welcome-glow-one" />
    <div className="welcome-glow welcome-glow-two" />
    <header className="welcome-header"><div className="welcome-brand"><BrandLogo /><span>{APP_NAME}</span></div><button type="button" onClick={() => navigate("/login")}>Log in</button></header>
    <section className="welcome-content">
      <div className="welcome-copy"><span className="welcome-kicker">Your matchday starts here</span><h1>Predict the score.<br /><em>Own the table.</em></h1><p>Call every result, back your club, and climb the league with points that reward real football insight.</p><div className="welcome-actions"><button className="welcome-primary" type="button" onClick={() => navigate("/login")}>Start playing <ArrowRight /></button><button className="welcome-secondary" type="button" onClick={() => navigate("/register")}>Create an account</button></div><div className="welcome-proof"><span><Check /> Free to play</span><span><Check /> One-minute setup</span></div></div>
      <div className="welcome-visual" aria-label="How Predictions Premier League works">
        <div className="welcome-orbit welcome-orbit-one" /><div className="welcome-orbit welcome-orbit-two" />
        <div className="welcome-score-card welcome-score-card-main"><div className="welcome-score-heading"><span>Matchday 01</span><strong>Premier League</strong></div><div className="welcome-teams"><div><span className="welcome-team-badge">A</span><strong>Arsenal</strong></div><b>2 <i>–</i> 1</b><div><span className="welcome-team-badge welcome-team-badge-dark">C</span><strong>Chelsea</strong></div></div><div className="welcome-score-footer"><span><Target /> Exact call</span><strong>+10 pts</strong></div></div>
        <div className="welcome-float-card welcome-float-points"><BarChart3 /><span><small>Your form</small><strong>+24 pts</strong></span></div>
        <div className="welcome-float-card welcome-float-rank"><Trophy /><span><small>League rank</small><strong>#04 <i>↑ 3</i></strong></span></div>
      </div>
    </section>
    <footer className="welcome-footer"><span>Make every score matter.</span><span>Independent prediction game</span></footer>
  </main>;
}
