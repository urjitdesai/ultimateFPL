import { zodResolver } from "@hookform/resolvers/zod";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ArrowRight, Check, ShieldCheck, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api, type Team } from "../api";
import { navigate } from "../navigation";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { auth } from "../firebase/client";

const schema = z.object({ displayName: z.string().trim().min(2, "Use at least 2 characters."), email: z.string().email("Enter a valid email address."), password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number."), favoriteTeamId: z.string().min(1, "Choose your club.") });
type Form = z.infer<typeof schema>;

export function RegisterPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [pageError, setPageError] = useState("");
  const { setProfile } = useAuth();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { displayName: "", email: "", password: "", favoriteTeamId: "" } });
  const selected = teams.find((team) => team.id === watch("favoriteTeamId"));

  useEffect(() => { api.teams().then(setTeams).catch(() => setPageError("We couldn't load the clubs. Check that the API is running, then refresh.")); }, []);

  const submit = handleSubmit(async (values) => {
    setPageError("");
    try {
      const existing = auth.currentUser?.email === values.email ? auth.currentUser : null;
      const user = existing ?? (await createUserWithEmailAndPassword(auth, values.email, values.password)).user;
      const profile = await api.registerProfile(user, values.displayName, values.favoriteTeamId);
      setProfile(profile);
      navigate("/dashboard");
    } catch (error) { setPageError(error instanceof Error ? error.message.replace("Firebase: ", "") : "We couldn't create your account."); }
  });

  return <AuthShell><div className="auth-card">
    <header className="form-header"><div><h2>Create your account</h2><p>One minute to your first matchday.</p></div><span className="secure-note"><ShieldCheck /> Secure signup</span></header>
    <form onSubmit={submit} noValidate>
      <div className="field-row"><label>Display name<input autoComplete="nickname" placeholder="How players will see you" {...register("displayName")} /></label><label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} /></label></div>
      <div className="error-row"><span>{errors.displayName?.message}</span><span>{errors.email?.message}</span></div>
      <label>Password<input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...register("password")} /></label>{errors.password ? <p className="field-error">{errors.password.message}</p> : <p className="field-help"><Check /> 8+ characters with a letter and number</p>}
      <label>Your club<select {...register("favoriteTeamId")}><option value="">Choose the team you back</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>{errors.favoriteTeamId && <p className="field-error">{errors.favoriteTeamId.message}</p>}
      <div className={`league-preview ${selected ? "selected" : ""}`}><span className="team-monogram">{selected?.shortName ?? "UFL"}</span><div><strong>{selected ? `${selected.name} Supporters` : "Your supporters league"}</strong><p><Users /> You’ll join automatically after signup.</p></div></div>
      {pageError && <div className="form-error" role="alert">{pageError}</div>}
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? "Joining the game…" : <>Join the game <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">Already playing? <a href="/login" onClick={(event) => { event.preventDefault(); navigate("/login"); }}>Log in</a></p>
  </div></AuthShell>;
}
