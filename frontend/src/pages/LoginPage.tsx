import { signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "../api";
import { googleSignInErrorMessage, loginErrorMessage } from "../auth/auth-errors";
import { useAuth } from "../auth/AuthContext";
import { lookupGoogleProfile } from "../auth/google-profile";
import { AuthShell } from "../components/AuthShell";
import { GoogleMark } from "../components/GoogleMark";
import { auth, googleProvider } from "../firebase/client";
import { navigate } from "../navigation";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const { setProfile, logout } = useAuth();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading("email");
    setError("");
    try {
      const user = (await signInWithEmailAndPassword(auth, email, password)).user;
      try {
        const profile = await api.profile(user);
        setProfile(profile);
        navigate("/dashboard");
      } catch (profileError) {
        if (profileError instanceof ApiError && profileError.code === "PROFILE_NOT_FOUND") {
          navigate("/complete-profile");
          return;
        }
        setError("Your login is valid, but your player profile could not be loaded. Try again in a moment.");
      }
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
    } finally {
      setLoading(null);
    }
  }

  async function signInWithGoogle() {
    setLoading("google");
    setError("");
    try {
      const user = (await signInWithPopup(auth, googleProvider)).user;
      try {
        const result = await lookupGoogleProfile(user);
        if (result.kind === "missing") {
          await logout().catch(() => undefined);
          setError("No Ultimate FPL account exists for this Google account. Sign up first, then try logging in again.");
          return;
        }
        setProfile(result.profile);
        navigate("/dashboard");
      } catch {
        await logout().catch(() => undefined);
        setError("Your Google login succeeded, but your player profile could not be loaded. Try again in a moment.");
      }
    } catch (googleError) {
      setError(googleSignInErrorMessage(googleError));
    } finally {
      setLoading(null);
    }
  }

  return <AuthShell><div className="auth-card login-card">
    <header className="form-header"><div><h2>Welcome back</h2><p>Your next big call is waiting.</p></div></header>
    {error ? <div className="form-error auth-flow-error" role="alert">{error}</div> : null}
    <button className="google-signin-button" type="button" onClick={signInWithGoogle} disabled={loading !== null}><GoogleMark />{loading === "google" ? "Logging in with Google…" : "Log in with Google"}</button>
    <div className="auth-divider"><span>or log in with email</span></div>
    <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <div className="forgot-password-link"><a href="/forgot-password" onClick={(event) => { event.preventDefault(); navigate("/forgot-password"); }}>Forgot password?</a></div>
      <button className="primary-button" disabled={loading !== null}>{loading === "email" ? "Opening your matchday…" : <>Log in <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">New to the game? <a href="/register" onClick={(event) => { event.preventDefault(); navigate("/register"); }}>Create an account</a></p>
  </div></AuthShell>;
}
