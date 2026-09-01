import { describe, expect, it } from "vitest";
import { emailRegistrationSchema } from "./registration";

describe("email registration validation", () => {
  it("accepts matching valid passwords", () => {
    expect(emailRegistrationSchema.safeParse({
      email: "alex@example.com",
      password: "matchday8",
      confirmPassword: "matchday8",
    }).success).toBe(true);
  });

  it("rejects a mismatched confirmation password", () => {
    const result = emailRegistrationSchema.safeParse({
      email: "alex@example.com",
      password: "matchday8",
      confirmPassword: "different8",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.confirmPassword).toContain("Passwords do not match.");
  });
});
