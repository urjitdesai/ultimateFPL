import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { navigate } from "../navigation";

export function AppNav({ active }: { active: "home" | "leagues" }) {
  const { profile, logout } = useAuth();
  return <nav className="home-nav">
    <button className="home-brand" onClick={() => navigate("/dashboard")}><span>UF</span> Ultimate Fantasy League</button>
    <div className="home-links"><a className={active === "home" ? "active" : ""} href="/dashboard">Home</a><a href="/dashboard#gameweeks">Gameweeks</a><a className={active === "leagues" ? "active" : ""} href="/leagues">Leagues</a></div>
    <div className="home-account"><span>Good evening, {profile?.managerName}</span><button onClick={logout}><LogOut /> Log out</button></div>
  </nav>;
}
