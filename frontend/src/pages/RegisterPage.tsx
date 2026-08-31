import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Team } from "../api";
import { navigate } from "../navigation";
import { googleSignUpErrorMessage } from "../auth/auth-errors";
import { useAuth } from "../auth/AuthContext";
import { lookupGoogleProfile } from "../auth/google-profile";
import { AuthShell } from "../components/AuthShell";
import { GoogleMark } from "../components/GoogleMark";
import { auth, googleProvider } from "../firebase/client";

const schema = z.object({
  firstName: z.string().trim().min(1, "Enter your first name.").max(50, "Use 50 characters or fewer."),
  lastName: z.string().trim().min(1, "Enter your last name.").max(50, "Use 50 characters or fewer."),
  managerName: z.string().trim().min(2, "Use at least 2 characters.").max(40, "Use 40 characters or fewer."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number."),
  favoriteTeamId: z.string().min(1, "Choose your club."),
});
type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageError, setPageError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setProfile, logout } = useAuth();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { firstName: "", lastName: "", managerName: "", email: "", password: "", favoriteTeamId: "" } });

  useEffect(() => { api.teams().then(setTeams).catch(() => setPageError("We couldn't load the clubs. Check that the API is running, then refresh.")); }, []);

  const submit = handleSubmit(async (values) => {
    setPageError("");
    try {
      const existing = auth.currentUser?.email === values.email ? auth.currentUser : null;
      const user = existing ?? (await createUserWithEmailAndPassword(auth, values.email, values.password)).user;
      const profile = await api.registerProfile(user, {
        firstName: values.firstName,
        lastName: values.lastName,
        managerName: values.managerName,
        favoriteTeamId: values.favoriteTeamId,
      });
      setProfile(profile);
      navigate("/dashboard");
    } catch (error) { setPageError(error instanceof Error ? error.message.replace("Firebase: ", "") : "We couldn't create your account."); }
  });

  async function signUpWithGoogle() {
    setGoogleLoading(true);
    setPageError("");
    try {
      const user = (await signInWithPopup(auth, googleProvider)).user;
      try {
        const result = await lookupGoogleProfile(user);
        if (result.kind === "existing") {
          await logout().catch(() => undefined);
          setPageError("An Ultimate FPL account already exists for this Google account. Log in instead.");
          return;
        }
        navigate("/complete-profile");
      } catch {
        await logout().catch(() => undefined);
        setPageError("Your Google sign-up succeeded, but we couldn't start profile setup. Try again in a moment.");
      }
    } catch (googleError) {
      setPageError(googleSignUpErrorMessage(googleError));
    } finally {
      setGoogleLoading(false);
    }
  }

  return <AuthShell><div className="auth-card">
    <header className="form-header"><div><h2>Create your account</h2><p>One minute to your first matchday.</p></div><span className="secure-note"><ShieldCheck /> Secure signup</span></header>
    {pageError && <div className="form-error auth-flow-error" role="alert">{pageError}</div>}
    <button className="google-signin-button" type="button" onClick={signUpWithGoogle} disabled={googleLoading || isSubmitting}><GoogleMark />{googleLoading ? "Signing up with Google…" : "Sign up with Google"}</button>
    <div className="auth-divider"><span>or sign up with email</span></div>
    <form onSubmit={submit} noValidate>
      <div className="field-row"><label>First name<input autoComplete="given-name" placeholder="Your first name" {...register("firstName")} />{errors.firstName ? <span className="field-message">{errors.firstName.message}</span> : null}</label><label>Last name<input autoComplete="family-name" placeholder="Your last name" {...register("lastName")} />{errors.lastName ? <span className="field-message">{errors.lastName.message}</span> : null}</label></div>
      <div className="field-row"><label>Manager name<input autoComplete="nickname" placeholder="How you appear in leagues" {...register("managerName")} />{errors.managerName ? <span className="field-message">{errors.managerName.message}</span> : null}</label><label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />{errors.email ? <span className="field-message">{errors.email.message}</span> : null}</label></div>
      <label>Password<input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register("password")} /></label>{errors.password ? <p className="field-error">{errors.password.message}</p> : <p className="field-help"><Check /> 8+ characters with a letter and number</p>}
      <label>Your club<select {...register("favoriteTeamId")}><option value="">Choose the team you back</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>{errors.favoriteTeamId && <p className="field-error">{errors.favoriteTeamId.message}</p>}
      <button className="primary-button" disabled={isSubmitting || googleLoading}>{isSubmitting ? "Joining the game…" : <>Join the game <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">Already playing? <a href="/login" onClick={(event) => { event.preventDefault(); navigate("/login"); }}>Log in</a></p>
  </div></AuthShell>;
}
