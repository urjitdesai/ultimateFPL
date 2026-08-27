import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { LeaguesPage } from "./pages/LeaguesPage";
import { LeagueStandingsPage } from "./pages/LeagueStandingsPage";
import { LeaguePlayerPredictionsPage } from "./pages/LeaguePlayerPredictionsPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { navigate } from "./navigation";

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    const knownPath = ["/register", "/login", "/forgot-password", "/dashboard", "/leagues"].includes(path) || /^\/leagues\/[^/]+(?:\/players\/[^/]+)?$/.test(path);
    if (path === "/" || !knownPath) navigate("/register", true);
    return () => window.removeEventListener("popstate", update);
  }, [path]);
  if (path === "/login") return <LoginPage />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (path === "/dashboard") return <HomePage />;
  if (path === "/leagues") return <LeaguesPage />;
  const playerMatch = path.match(/^\/leagues\/([^/]+)\/players\/([^/]+)$/);
  if (playerMatch) return <LeaguePlayerPredictionsPage leagueId={decodeURIComponent(playerMatch[1]!)} memberUserId={decodeURIComponent(playerMatch[2]!)} />;
  if (path.startsWith("/leagues/")) return <LeagueStandingsPage leagueId={decodeURIComponent(path.slice("/leagues/".length))} />;
  return <RegisterPage />;
}
