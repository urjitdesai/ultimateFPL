import { signInWithEmailAndPassword } from "firebase/auth";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { api } from "../api";
import { navigate } from "../navigation";
import { useAuth } from "../auth/AuthContext";
import { AuthShell } from "../components/AuthShell";
import { auth } from "../firebase/client";

export function LoginPage() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [loading, setLoading] = useState(false);
  const { setProfile } = useAuth();
  async function submit(event: React.FormEvent) { event.preventDefault(); setLoading(true); setError(""); try { const user = (await signInWithEmailAndPassword(auth, email, password)).user; const profile = await api.profile(user); setProfile(profile); navigate("/dashboard"); } catch { setError("That email and password combination didn’t work, or your profile still needs completing."); } finally { setLoading(false); } }
  return <AuthShell><div className="auth-card login-card"><header className="form-header"><div><h2>Welcome back</h2><p>Your next big call is waiting.</p></div></header><form onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? "Opening your matchday…" : <>Log in <ArrowRight /></>}</button></form><p className="auth-switch">New to the game? <a href="/register" onClick={(event) => { event.preventDefault(); navigate("/register"); }}>Create an account</a></p></div></AuthShell>;
}
