import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Team } from "../api";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { navigate } from "../navigation";

const schema = z.object({ favoriteTeamId: z.string().min(1, "Choose your favorite team.") });
type Form = z.infer<typeof schema>;

function profileDisplayName(displayName: string | null, email: string | null) {
  const candidate = displayName?.trim() || email?.split("@")[0]?.trim() || "FPL Player";
  return candidate.length >= 2 ? candidate.slice(0, 40) : "FPL Player";
}

export function CompleteProfilePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageError, setPageError] = useState("");
  const { user, profile, loading, setProfile, logout } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { favoriteTeamId: "" } });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", true);
    else if (profile) navigate("/dashboard", true);
  }, [loading, profile, user]);

  useEffect(() => {
    if (!user || profile) return;
    let active = true;
    api.teams()
      .then((nextTeams) => { if (active) setTeams(nextTeams); })
      .catch(() => { if (active) setPageError("We couldn't load the teams. Refresh the page and try again."); });
    return () => { active = false; };
  }, [profile, user]);

  const submit = handleSubmit(async ({ favoriteTeamId }) => {
    if (!user) return;
    setPageError("");
    try {
      const nextProfile = await api.registerProfile(user, profileDisplayName(user.displayName, user.email), favoriteTeamId);
      setProfile(nextProfile);
      navigate("/dashboard");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We couldn't finish setting up your account.");
    }
  });

  if (loading || !user || profile) return <div className="loading-screen">Loading your account…</div>;

  return <AuthShell><div className="auth-card login-card complete-profile-card">
    <header className="form-header"><div><h2>Choose your team</h2><p>One last pick before your first matchday.</p></div></header>
    <div className="google-account-note"><span>Signed in with Google</span><strong>{user.email}</strong></div>
    <form onSubmit={submit} noValidate>
      <label>Favorite team<select autoFocus {...register("favoriteTeamId")}><option value="">Choose the team you back</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {errors.favoriteTeamId ? <p className="field-error">{errors.favoriteTeamId.message}</p> : null}
      {pageError ? <div className="form-error" role="alert">{pageError}</div> : null}
      <button className="primary-button" disabled={isSubmitting || teams.length === 0}>{isSubmitting ? "Finishing setup…" : <>Finish setup <ArrowRight /></>}</button>
    </form>
    <button className="change-google-account" type="button" onClick={async () => { await logout(); navigate("/login", true); }}><LogOut /> Use another account</button>
  </div></AuthShell>;
}
