import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { loginErrorMessage } from "../auth/auth-errors";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { auth } from "../firebase/client";
import { navigate } from "../navigation";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setProfile } = useAuth();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
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
      setLoading(false);
    }
  }

  return <AuthShell><div className="auth-card login-card">
    <header className="form-header"><div><h2>Welcome back</h2><p>Your next big call is waiting.</p></div></header>
    <form onSubmit={submit}>
      <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <div className="forgot-password-link"><a href="/forgot-password" onClick={(event) => { event.preventDefault(); navigate("/forgot-password"); }}>Forgot password?</a></div>
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <button className="primary-button" disabled={loading}>{loading ? "Opening your matchday…" : <>Log in <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">New to the game? <a href="/register" onClick={(event) => { event.preventDefault(); navigate("/register"); }}>Create an account</a></p>
  </div></AuthShell>;
}
