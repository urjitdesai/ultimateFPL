import { signInWithEmailAndPassword, signInWithPopup, type User } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { api, ApiError } from "../api";
import { googleSignInErrorMessage, loginErrorMessage } from "../auth/auth-errors";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { auth, googleProvider } from "../firebase/client";
import { navigate } from "../navigation";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState<"email" | "google" | null>(null);
  const { setProfile } = useAuth();

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
      } catch {
        setError("Your login is valid, but your player profile could not be loaded. Try again in a moment.");
      }
    } catch (loginError) {
      setError(loginErrorMessage(loginError));
    } finally {
      setLoading(null);
    }
  }

  async function finishGoogleLogin(user: User) {
    try {
      const profile = await api.profile(user);
      setProfile(profile);
      navigate("/dashboard");
    } catch (profileError) {
      if (profileError instanceof ApiError && profileError.code === "PROFILE_NOT_FOUND") {
        navigate("/complete-profile");
        return;
      }
      setError("Your Google login succeeded, but your player profile could not be loaded. Try again in a moment.");
    }
  }

  async function signInWithGoogle() {
    setLoading("google");
    setError("");
    try {
      const user = (await signInWithPopup(auth, googleProvider)).user;
      await finishGoogleLogin(user);
    } catch (googleError) {
      setError(googleSignInErrorMessage(googleError));
    } finally {
      setLoading(null);
    }
  }

  return <AuthShell><div className="auth-card login-card">
    <header className="form-header"><div><h2>Welcome back</h2><p>Your next big call is waiting.</p></div></header>
    {error ? <div className="form-error login-error" role="alert">{error}</div> : null}
    <button className="google-signin-button" type="button" onClick={signInWithGoogle} disabled={loading !== null}><GoogleMark />{loading === "google" ? "Connecting to Google…" : "Continue with Google"}</button>
    <div className="auth-divider"><span>or use your email</span></div>
    <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <div className="forgot-password-link"><a href="/forgot-password" onClick={(event) => { event.preventDefault(); navigate("/forgot-password"); }}>Forgot password?</a></div>
      <button className="primary-button" disabled={loading !== null}>{loading === "email" ? "Opening your matchday…" : <>Log in <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">New to the game? <a href="/register" onClick={(event) => { event.preventDefault(); navigate("/register"); }}>Create an account</a></p>
  </div></AuthShell>;
}

function GoogleMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><path fill="#4285f4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.4 2.9-7.4Z"/><path fill="#34a853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.6A10 10 0 0 0 12 22Z"/><path fill="#fbbc05" d="M6.5 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.5 14Z"/><path fill="#ea4335" d="M12 6a5.4 5.4 0 0 1 3.8 1.5l2.9-2.8A9.7 9.7 0 0 0 12 2a10 10 0 0 0-8.9 5.5l3.4 2.6A5.9 5.9 0 0 1 12 6Z"/></svg>;
}
