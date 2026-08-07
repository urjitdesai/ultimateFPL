import { ArrowRight, CalendarDays, Check, Copy, KeyRound, Plus, Shield, Trophy, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { api, type League } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AppNav } from "../components/AppNav";
import { navigate } from "../navigation";

const leagueIcon = { OVERALL: Trophy, TEAM_DEFAULT: Shield, GAMEWEEK_DEFAULT: CalendarDays, CUSTOM: Users };
const leagueLabel = { OVERALL: "Global league", TEAM_DEFAULT: "Supporters league", GAMEWEEK_DEFAULT: "Entry cohort", CUSTOM: "Private league" };

export function LeaguesPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [scoringType, setScoringType] = useState<"CLASSIC" | "WAGER">("CLASSIC");
  const [inviteCode, setInviteCode] = useState("");
  const [createdCode, setCreatedCode] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState<"create" | "join" | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.leagues(user).then(setLeagues).catch(() => setError("We couldn't load your leagues.")).finally(() => setLoading(false));
  }, [user]);

  const createCustomLeague = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || name.trim().length < 3) return;
    setSubmitting("create"); setActionError(""); setCreatedCode("");
    try {
      const league = await api.createLeague(user, name.trim(), scoringType);
      setLeagues((current) => [league, ...current]);
      setCreatedCode(league.inviteCode ?? "");
      setName("");
    } catch (requestError) { setActionError(requestError instanceof Error ? requestError.message : "We couldn't create the league."); }
    finally { setSubmitting(null); }
  };

  const joinCustomLeague = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || inviteCode.trim().length < 6) return;
    setSubmitting("join"); setActionError("");
    try {
      const league = await api.joinLeague(user, inviteCode);
      setLeagues((current) => current.some((entry) => entry.id === league.id) ? current : [league, ...current]);
      setInviteCode("");
      navigate(`/leagues/${encodeURIComponent(league.id)}`);
    } catch (requestError) { setActionError(requestError instanceof Error ? requestError.message : "We couldn't join that league."); }
    finally { setSubmitting(null); }
  };

  const copyCreatedCode = async () => {
    await navigator.clipboard.writeText(createdCode);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  if (authLoading) return <div className="loading-screen">Preparing your leagues…</div>;
  if (!user || !profile) { queueMicrotask(() => navigate("/login", true)); return <div className="loading-screen">Returning to login…</div>; }

  return <main className="league-page">
    <AppNav active="leagues" />
    <header className="league-hero"><span>Your competition</span><h1>Your leagues</h1><p>Every table. Every rival. One place to see where you stand.</p></header>
    <section className="league-directory">
      <div className="league-actions">
        <form className="league-action-card" onSubmit={createCustomLeague}><span className="league-action-icon"><Plus /></span><div><h2>Create a league</h2><p>Name your competition, choose its rules and get a key to share.</p><label><span>League name</span><input value={name} maxLength={50} placeholder="Friday Night Rivals" onChange={(event) => setName(event.target.value)} /></label><label><span>League format</span><select value={scoringType} onChange={(event) => setScoringType(event.target.value as "CLASSIC" | "WAGER")}><option value="CLASSIC">Classic</option><option value="WAGER">Wager</option></select></label><button disabled={submitting !== null || name.trim().length < 3}>{submitting === "create" ? "Creating…" : "Create league"}</button></div></form>
        <form className="league-action-card" onSubmit={joinCustomLeague}><span className="league-action-icon"><KeyRound /></span><div><h2>Join a league</h2><p>Enter the key shared by the league creator.</p><label><span>League key</span><input className="invite-code-input" value={inviteCode} maxLength={12} autoCapitalize="characters" placeholder="ABCD2345" onChange={(event) => setInviteCode(event.target.value.toUpperCase())} /></label><button disabled={submitting !== null || inviteCode.trim().length < 6}>{submitting === "join" ? "Joining…" : "Join league"}</button></div></form>
      </div>
      {createdCode ? <div className="invite-success" role="status"><Check /><span><strong>League created</strong><small>Share this key with anyone you want to invite.</small></span><code>{createdCode}</code><button onClick={copyCreatedCode}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy key"}</button></div> : null}
      {actionError ? <div className="home-error league-action-error" role="alert">{actionError}</div> : null}
      <div className="section-kicker"><Users /> {leagues.length} joined leagues</div>
      <div className="league-directory-head"><span>League</span><span>Type</span><span>Members</span><span /></div>
      {loading ? <div className="league-loading">Loading league tables…</div> : error ? <div className="home-error" role="alert">{error}<button onClick={() => window.location.reload()}>Retry</button></div> : leagues.map((league) => {
        const Icon = leagueIcon[league.type];
        return <button className="league-directory-row" key={league.id} onClick={() => navigate(`/leagues/${encodeURIComponent(league.id)}`)}>
          <span className="directory-league"><i><Icon /></i><span><strong>{league.name}</strong><small>View full standings</small></span></span>
          <span className="league-type">{league.scoringType === "WAGER" ? "Wager league" : leagueLabel[league.type]}</span>
          <span className="member-total"><strong>{league.memberCount}</strong> {league.memberCount === 1 ? "player" : "players"}</span>
          <ArrowRight />
        </button>;
      })}
    </section>
  </main>;
}
