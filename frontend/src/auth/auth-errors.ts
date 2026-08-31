export function loginErrorMessage(error: unknown) {
  const code = firebaseErrorCode(error);

  if ([
    "auth/invalid-credential",
    "auth/invalid-login-credentials",
    "auth/invalid-email",
    "auth/user-not-found",
    "auth/wrong-password",
  ].includes(code)) return "Incorrect email or password.";
  if (code === "auth/user-disabled") return "This account has been disabled. Contact support for help.";
  if (code === "auth/too-many-requests") return "Too many unsuccessful attempts. Wait a few minutes or reset your password.";
  if (code === "auth/network-request-failed") return "We couldn't reach the login service. Check your connection and try again.";
  return "We couldn't log you in. Try again.";
}

export function googleSignInErrorMessage(error: unknown) {
  return googleAuthErrorMessage(error, "sign-in");
}

export function googleSignUpErrorMessage(error: unknown) {
  return googleAuthErrorMessage(error, "sign-up");
}

function googleAuthErrorMessage(error: unknown, flow: "sign-in" | "sign-up") {
  const code = firebaseErrorCode(error);
  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return `Google ${flow} was closed before it finished.`;
  if (code === "auth/popup-blocked") return `Your browser blocked the Google ${flow} window. Allow popups and try again.`;
  if (code === "auth/account-exists-with-different-credential") return "An account already exists for this email. Log in with your email and password instead.";
  if (code === "auth/unauthorized-domain") return `Google ${flow} is not enabled for this website yet.`;
  if (code === "auth/network-request-failed") return `We couldn't reach Google ${flow}. Check your connection and try again.`;
  return `We couldn't complete Google ${flow}. Try again.`;
}

function firebaseErrorCode(error: unknown) {
  return typeof error === "object" && error != null && "code" in error
    ? String((error as { code?: unknown }).code)
    : "";
}

export function isUnknownPasswordResetEmail(error: unknown) {
  return firebaseErrorCode(error) === "auth/user-not-found";
}

export function passwordResetErrorMessage(error: unknown) {
  const code = firebaseErrorCode(error);
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/too-many-requests") return "Too many reset attempts. Wait a few minutes and try again.";
  if (code === "auth/network-request-failed") return "We couldn't reach the reset service. Check your connection and try again.";
  return "We couldn't send the reset email. Try again.";
}
