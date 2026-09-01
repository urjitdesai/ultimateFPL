import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ArrowRight, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Team } from "../api";
import { useAuth } from "../auth/AuthContext";
import { googleProfileNameDefaults } from "../auth/profile-names";
import { AuthShell } from "../components/AuthShell";
import { OnboardingProgress } from "../components/OnboardingProgress";
import { auth } from "../firebase/client";
import { navigate } from "../navigation";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(50, "Use 50 characters or fewer."),
  lastName: z.string().trim().max(50, "Use 50 characters or fewer."),
  managerName: z.string().trim().min(2, "Use at least 2 characters.").max(40, "Use 40 characters or fewer."),
  favoriteTeamId: z.string().min(1, "Choose your favorite team."),
});
type Form = z.infer<typeof schema>;

export function CompleteProfilePage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageError, setPageError] = useState("");
  const { user, profile, loading, pendingEmailSignup, setPendingEmailSignup, setProfile, logout } = useAuth();
  const pendingEmail = pendingEmailSignup?.email;
  const { register, handleSubmit, reset, getValues, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", managerName: "", favoriteTeamId: "" } });
  const isGoogleUser = user?.providerData.some((provider) => provider.providerId === "google.com") ?? false;

  useEffect(() => {
    if (loading) return;
    if (!user && !auth.currentUser && !pendingEmail) navigate("/register", true);
    else if (profile) navigate("/dashboard", true);
  }, [loading, pendingEmail, profile, user]);

  useEffect(() => {
    if (!user || !isGoogleUser) return;
    const names = googleProfileNameDefaults(user.displayName, user.email);
    reset({ ...getValues(), firstName: names.firstName, lastName: names.lastName });
  }, [getValues, isGoogleUser, reset, user]);

  useEffect(() => {
    if ((!user && !pendingEmail) || profile) return;
    let active = true;
    api.teams()
      .then((nextTeams) => { if (active) setTeams(nextTeams); })
      .catch(() => { if (active) setPageError("We couldn't load the teams. Refresh the page and try again."); });
    return () => { active = false; };
  }, [pendingEmail, profile, user]);

  const submit = handleSubmit(async ({ firstName, lastName, managerName, favoriteTeamId }) => {
    setPageError("");
    try {
      let registrationUser = user ?? auth.currentUser;
      if (pendingEmailSignup) {
        const signedInEmailMatches = registrationUser?.email?.toLowerCase() === pendingEmailSignup.email.toLowerCase()
          && registrationUser.providerData.some((provider) => provider.providerId === "password");
        if (!signedInEmailMatches) {
          registrationUser = (await createUserWithEmailAndPassword(auth, pendingEmailSignup.email, pendingEmailSignup.password)).user;
        }
      }
      if (!registrationUser) return;
      const nextProfile = await api.registerProfile(registrationUser, { firstName, lastName, managerName, favoriteTeamId });
      setProfile(nextProfile);
      setPendingEmailSignup(null);
      navigate("/dashboard");
    } catch (error) {
      setPageError(error instanceof Error ? error.message.replace("Firebase: ", "") : "We couldn't finish setting up your account.");
    }
  });

  if (loading || (!user && !pendingEmailSignup) || profile) return <div className="loading-screen">Loading your account…</div>;

  return <AuthShell><div className="auth-card login-card complete-profile-card">
    <header className="form-header"><div><h2>Complete your profile</h2><p>Tell us who you are and choose your team.</p></div></header>
    <OnboardingProgress step={2} />
    <div className="google-account-note"><span>{isGoogleUser ? "Signed up with Google" : "Email signup"}</span><strong>{pendingEmail ?? user?.email}</strong></div>
    <form onSubmit={submit} noValidate>
      <div className="field-row"><label><span className="field-label">First name <small>Required</small></span><input autoFocus={!isGoogleUser} autoComplete="given-name" {...register("firstName")} />{errors.firstName ? <span className="field-message">{errors.firstName.message}</span> : null}</label><label><span className="field-label">Last name <small>Optional</small></span><input autoComplete="family-name" {...register("lastName")} />{errors.lastName ? <span className="field-message">{errors.lastName.message}</span> : null}</label></div>
      <label>Manager name<input autoFocus={isGoogleUser} autoComplete="nickname" placeholder="How you appear in leagues" {...register("managerName")} /></label>
      {errors.managerName ? <p className="field-error">{errors.managerName.message}</p> : null}
      <label>Favorite team<select {...register("favoriteTeamId")}><option value="">Choose the team you back</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
      {errors.favoriteTeamId ? <p className="field-error">{errors.favoriteTeamId.message}</p> : null}
      {pageError ? <div className="form-error" role="alert">{pageError}</div> : null}
      <button className="primary-button" disabled={isSubmitting || teams.length === 0}>{isSubmitting ? pendingEmailSignup ? "Creating account…" : "Finishing setup…" : <>Finish setup <ArrowRight /></>}</button>
    </form>
    <button className="change-google-account" type="button" onClick={async () => { await logout(); navigate("/register", true); }}><LogOut /> Start over with another account</button>
  </div></AuthShell>;
}
