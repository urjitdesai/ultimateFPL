import { describe, expect, it } from "vitest";
import { googleProfileNameDefaults } from "./profile-names";

describe("Google profile name defaults", () => {
  it("splits a Google display name into first and last names", () => {
    expect(googleProfileNameDefaults("Alex Morgan Smith", "alex@example.com"))
      .toEqual({ firstName: "Alex", lastName: "Morgan Smith" });
  });

  it("falls back to the email prefix when Google has no display name", () => {
    expect(googleProfileNameDefaults(null, "alex@example.com"))
      .toEqual({ firstName: "alex", lastName: "" });
  });

  it("leaves names empty when Google supplies no usable details", () => {
    expect(googleProfileNameDefaults(null, null))
      .toEqual({ firstName: "", lastName: "" });
  });
});
