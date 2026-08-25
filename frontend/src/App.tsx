import { useEffect, useState } from "react";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { HomePage } from "./pages/HomePage";
import { LeaguesPage } from "./pages/LeaguesPage";
import { LeagueStandingsPage } from "./pages/LeagueStandingsPage";
import { navigate } from "./navigation";

export function App() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener("popstate", update);
    const knownPath = ["/register", "/login", "/dashboard", "/leagues"].includes(path) || /^\/leagues\/[^/]+$/.test(path);
    if (path === "/" || !knownPath) navigate("/register", true);
    return () => window.removeEventListener("popstate", update);
  }, [path]);
  if (path === "/login") return <LoginPage />;
  if (path === "/dashboard") return <HomePage />;
  if (path === "/leagues") return <LeaguesPage />;
  if (path.startsWith("/leagues/")) return <LeagueStandingsPage leagueId={decodeURIComponent(path.slice("/leagues/".length))} />;
  return <RegisterPage />;
}
