import { CircleDotDashed } from "lucide-react";

export function BrandPanel() {
  return <aside className="brand-panel">
    <div className="brand-wordmark"><span className="brand-mark"><CircleDotDashed /></span><span>Ultimate Fantasy League</span></div>
    <div className="brand-copy"><h1>Make every<br /><span>score matter.</span></h1><p>Call the result. Back your club. Climb the table with every matchday.</p></div>
    <p className="disclaimer">Independent free-to-play outcome game. Points have no cash value. Not affiliated with the Premier League or its clubs.</p>
  </aside>;
}
