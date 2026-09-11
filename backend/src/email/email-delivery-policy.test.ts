import { describe, expect, it } from "vitest";
import { emailHasNotBeenAttempted } from "./email-delivery-policy.js";

describe("email delivery policy", () => {
  it("allows a newly queued email to be attempted once", () => {
    expect(emailHasNotBeenAttempted(undefined)).toBe(true);
    expect(emailHasNotBeenAttempted(0)).toBe(true);
  });

  it("does not retry an email after any delivery attempt", () => {
    expect(emailHasNotBeenAttempted(1)).toBe(false);
    expect(emailHasNotBeenAttempted(2)).toBe(false);
    expect(emailHasNotBeenAttempted(3)).toBe(false);
  });
});
