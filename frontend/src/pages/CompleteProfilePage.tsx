import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Team } from "../api";
import { useAuth } from "../auth/AuthContext";
import { googleProfileNameDefaults } from "../auth/profile-names";
import { AuthShell } from "../components/AuthShell";
import { navigate } from "../navigation";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(50, "Use 50 characters or fewer."),
  lastName: z.string().trim().min(1, "Enter your last name.").max(50, "Use 50 characters or fewer."),
  managerName: z.string().trim().min(2, "Use at least 2 characters.").max(40, "Use 40 characters or fewer."),
  favoriteTeamId: z.string().min(1, "Choose your favorite team."),
});
type Form = z.infer<typeof schema>;

export function CompleteProfilePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageError, setPageError] = useState("");
  const { user, profile, loading, setProfile, logout } = useAuth();
  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", managerName: "", favoriteTeamId: "" } });

  useEffect(() => {
    if (loading) return;
    if (!user) navigate("/login", true);
    else if (profile) navigate("/dashboard", true);
  }, [loading, profile, user]);

  useEffect(() => {
    if (!user) return;
    const names = googleProfileNameDefaults(user.displayName, user.email);
    reset({ ...getValues(), firstName: names.firstName, lastName: names.lastName });
  }, [getValues, reset, user]);

  useEffect(() => {
    if (!user || profile) return;
    let active = true;
    api.teams()
      .then((nextTeams) => { if (active) setTeams(nextTeams); })
      .catch(() => { if (active) setPageError("We couldn't load the teams. Refresh the page and try again."); });
    return () => { active = false; };
  }, [profile, user]);

  const submit = handleSubmit(async ({ firstName, lastName, managerName, favoriteTeamId }) => {
    if (!user) return;
    setPageError("");
    try {
      const nextProfile = await api.registerProfile(user, { firstName, lastName, managerName, favoriteTeamId });
      setProfile(nextProfile);
      navigate("/dashboard");
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "We couldn't finish setting up your account.");
    }
  });

  if (loading || !user || profile) return <div className="loading-screen">Loading your account…</div>;

  return <AuthShell><div className="auth-card login-card complete-profile-card">
    <header className="form-header"><div><h2>Complete your profile</h2><p>Choose your manager name and team.</p></div></header>
    <div className="google-account-note"><span>Signed in with Google</span><strong>{user.email}</strong></div>
    <form onSubmit={submit} noValidate>
      <div className="field-row"><label>First name<input autoComplete="given-name" {...register("firstName")} />{errors.firstName ? <span className="field-message">{errors.firstName.message}</span> : null}</label><label>Last name<input autoComplete="family-name" {...register("lastName")} />{errors.lastName ? <span className="field-message">{errors.lastName.message}</span> : null}</label></div>
      <label>Manager name<input autoFocus autoComplete="nickname" placeholder="How you appear in leagues" {...register("managerName")} /></label>
      {errors.managerName ? <p className="field-error">{errors.managerName.message}</p> : null}
      <label>Favorite team<select {...register("favoriteTeamId")}><option value="">Choose the team you back</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {errors.favoriteTeamId ? <p className="field-error">{errors.favoriteTeamId.message}</p> : null}
      {pageError ? <div className="form-error" role="alert">{pageError}</div> : null}
      <button className="primary-button" disabled={isSubmitting || teams.length === 0}>{isSubmitting ? "Finishing setup…" : <>Finish setup <ArrowRight /></>}</button>
    </form>
    <button className="change-google-account" type="button" onClick={async () => { await logout(); navigate("/login", true); }}><LogOut /> Use another account</button>
  </div></AuthShell>;
}
