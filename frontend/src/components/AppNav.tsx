import { BookOpen, House, LogOut, Users } from "lucide-react";
import type { MouseEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../navigation";

export function AppNav({ active }: { active: "home" | "leagues" }) {
  const { profile, logout } = useAuth();
  const open = (event: MouseEvent<HTMLAnchorElement>, path: string) => {
    event.preventDefault();
    navigate(path);
  };

  return <>
    <nav className="home-nav">
      <button className="home-brand" onClick={() => navigate("/dashboard")}><span>UF</span> Ultimate Fantasy League</button>
      <div className="home-links"><a className={active === "home" ? "active" : ""} href="/dashboard">Home</a><a className={active === "leagues" ? "active" : ""} href="/leagues">Leagues</a><a href="/onboarding" onClick={(event) => open(event, "/onboarding")}>How to play</a></div>
      <div className="home-account"><span>Good evening, {profile?.managerName}</span><button onClick={logout}><LogOut /> Log out</button></div>
    </nav>
    <nav className="mobile-tab-bar" aria-label="Primary navigation">
      <a className={active === "home" ? "is-active" : ""} href="/dashboard" aria-current={active === "home" ? "page" : undefined} onClick={(event) => open(event, "/dashboard")}><House /><span>Home</span></a>
      <a className={active === "leagues" ? "is-active" : ""} href="/leagues" aria-current={active === "leagues" ? "page" : undefined} onClick={(event) => open(event, "/leagues")}><Users /><span>Leagues</span></a>
      <a href="/onboarding" onClick={(event) => open(event, "/onboarding")}><BookOpen /><span>How to play</span></a>
    </nav>
  </>;
}
