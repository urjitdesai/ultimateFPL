import { describe, expect, it } from "vitest";
import {
  isUnknownPasswordResetEmail,
  loginErrorMessage,
  passwordResetErrorMessage,
} from "./auth-errors";

describe("login error messages", () => {
  it("uses one safe message for invalid email and password credentials", () => {
    expect(loginErrorMessage({ code: "auth/invalid-credential" })).toBe("Incorrect email or password.");
    expect(loginErrorMessage({ code: "auth/user-not-found" })).toBe("Incorrect email or password.");
    expect(loginErrorMessage({ code: "auth/wrong-password" })).toBe("Incorrect email or password.");
  });

  it("explains throttling and network failures", () => {
    expect(loginErrorMessage({ code: "auth/too-many-requests" })).toContain("Too many unsuccessful attempts");
    expect(loginErrorMessage({ code: "auth/network-request-failed" })).toContain("Check your connection");
  });

  it("keeps unknown password-reset emails private and explains recoverable failures", () => {
    expect(isUnknownPasswordResetEmail({ code: "auth/user-not-found" })).toBe(true);
    expect(passwordResetErrorMessage({ code: "auth/invalid-email" })).toBe("Enter a valid email address.");
    expect(passwordResetErrorMessage({ code: "auth/network-request-failed" })).toContain("Check your connection");
  });
});
