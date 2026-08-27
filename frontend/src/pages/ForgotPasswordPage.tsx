import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import {
  isUnknownPasswordResetEmail,
  passwordResetErrorMessage,
} from "../auth/auth-errors";
import { AuthShell } from "../components/AuthShell";
import { auth } from "../firebase/client";
import { navigate } from "../navigation";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (resetError) {
      // Older Firebase projects may return user-not-found when email
      // enumeration protection is disabled. Keep the response private.
      if (isUnknownPasswordResetEmail(resetError)) setSent(true);
      else setError(passwordResetErrorMessage(resetError));
    } finally {
      setLoading(false);
    }
  }

  return <AuthShell><div className="auth-card login-card password-reset-card">
    <button className="auth-back-link" type="button" onClick={() => navigate("/login")}><ArrowLeft /> Back to login</button>

    {!sent ? <>
      <header className="form-header"><div><h2>Reset password</h2><p>We’ll email you a secure link to choose a new password.</p></div><span className="reset-icon"><Mail /></span></header>
      <form onSubmit={submit}>
        <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        {error ? <div className="form-error" role="alert">{error}</div> : null}
        <button className="primary-button" disabled={loading}>{loading ? "Sending link…" : <>Send reset link <ArrowRight /></>}</button>
      </form>
    </> : <div className="reset-success" role="status">
      <CheckCircle2 />
      <h2>Check your email</h2>
      <p>If an account exists for <strong>{email.trim()}</strong>, Firebase has sent it a password-reset link.</p>
      <button className="primary-button" type="button" onClick={() => navigate("/login")}>Back to login <ArrowRight /></button>
      <button className="reset-another-email" type="button" onClick={() => { setSent(false); setError(""); }}>Use another email</button>
    </div>}
  </div></AuthShell>;
}
