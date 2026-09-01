import { zodResolver } from "@hookform/resolvers/zod";
import { signInWithPopup } from "firebase/auth";
import { ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { navigate } from "../navigation";
import { googleSignUpErrorMessage } from "../auth/auth-errors";
import { useAuth } from "../auth/AuthContext";
import { lookupGoogleProfile } from "../auth/google-profile";
import { emailRegistrationSchema, type EmailRegistrationForm } from "../auth/registration";
import { AuthShell } from "../components/AuthShell";
import { GoogleMark } from "../components/GoogleMark";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { auth, googleProvider } from "../firebase/client";

export function RegisterPage() {
  const [pageError, setPageError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const { logout, setPendingEmailSignup } = useAuth();
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EmailRegistrationForm>({ resolver: zodResolver(emailRegistrationSchema), mode: "onChange", defaultValues: { email: "", password: "", confirmPassword: "" } });
  const password = useWatch({ control, name: "password" });
  const confirmPassword = useWatch({ control, name: "confirmPassword" });
  const passwordStarted = password.length > 0;
  const passwordChecks = [
    { label: "8+ characters", valid: password.length >= 8 },
    { label: "One letter", valid: /[A-Za-z]/.test(password) },
    { label: "One number", valid: /\d/.test(password) },
  ];
  const passwordValid = passwordChecks.every((check) => check.valid);
  const confirmationStarted = confirmPassword.length > 0;
  const passwordsMatch = confirmationStarted && password === confirmPassword;

  const submit = handleSubmit(async (values) => {
    setPageError("");
    try {
      if (auth.currentUser) await logout();
      setPendingEmailSignup({ email: values.email.trim(), password: values.password });
      navigate("/complete-profile");
    } catch (error) { setPageError(error instanceof Error ? error.message.replace("Firebase: ", "") : "We couldn't continue your signup."); }
  });

  async function signUpWithGoogle() {
    setGoogleLoading(true);
    setPageError("");
    try {
      setPendingEmailSignup(null);
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
      <label>Email address<input type="email" autoComplete="email" placeholder="you@example.com" {...register("email")} />{errors.email ? <span className="field-message">{errors.email.message}</span> : null}</label>
      <label>Password<input className={passwordStarted ? passwordValid ? "validation-valid" : "validation-invalid" : ""} type="password" autoComplete="new-password" placeholder="At least 8 characters" aria-invalid={passwordStarted && !passwordValid} aria-describedby="password-validation" {...register("password")} /></label>
      <div className="password-validation" id="password-validation" aria-live="polite">{passwordChecks.map((check) => <span className={passwordStarted ? check.valid ? "is-valid" : "is-invalid" : "is-pending"} key={check.label}>{passwordStarted ? check.valid ? <Check /> : <X /> : <i />}{check.label}</span>)}</div>
      <label>Confirm password<input className={confirmationStarted ? passwordsMatch ? "validation-valid" : "validation-invalid" : ""} type="password" autoComplete="new-password" placeholder="Enter it again" aria-invalid={confirmationStarted && !passwordsMatch} aria-describedby="confirm-password-validation" {...register("confirmPassword")} /></label>
      <p className={`confirm-password-validation ${confirmationStarted ? passwordsMatch ? "is-valid" : "is-invalid" : errors.confirmPassword ? "is-invalid" : "is-pending"}`} id="confirm-password-validation" aria-live="polite">{confirmationStarted ? passwordsMatch ? <><Check /> Passwords match.</> : <><X /> Passwords do not match.</> : errors.confirmPassword ? <><X /> Confirm your password.</> : "Enter the same password again."}</p>
      <button className="primary-button" disabled={isSubmitting || googleLoading}>{isSubmitting ? <LoadingIndicator compact label="Continuing to profile…" /> : <>Continue to profile <ArrowRight /></>}</button>
    </form>
    <p className="auth-switch">Already playing? <a href="/login" onClick={(event) => { event.preventDefault(); navigate("/login"); }}>Log in</a></p>
  </div></AuthShell>;
}
