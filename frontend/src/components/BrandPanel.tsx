import { APP_NAME } from "../brand";
import { BrandLogo } from "./BrandLogo";

export function BrandPanel() {
  return <aside className="brand-panel">
    <div className="brand-wordmark"><BrandLogo /><span>{APP_NAME}</span></div>
    <div className="brand-copy"><h1>Make every<br /><span>score matter.</span></h1><p>Call the result. Back your club. Climb the table with every matchday.</p></div>
    <p className="disclaimer">Independent prediction game. Not affiliated with the Premier League or its clubs.</p>
  </aside>;
}
