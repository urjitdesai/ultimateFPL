import { describe, expect, it } from "vitest";
import { usersWithCompleteGameweekSubmission } from "./submission-status.js";

describe("prediction reminder submission checks", () => {
  it("includes only users who submitted every fixture in the gameweek", () => {
    const submittedUsers = usersWithCompleteGameweekSubmission(
      ["fixture-1", "fixture-2"],
      [
        { userId: "complete", fixtureId: "fixture-1", submitted: true },
        { userId: "complete", fixtureId: "fixture-2", submitted: true },
        { userId: "partial", fixtureId: "fixture-1", submitted: true },
        { userId: "defaulted", fixtureId: "fixture-1", submitted: false },
        { userId: "defaulted", fixtureId: "fixture-2", submitted: false },
        { userId: "complete", fixtureId: "another-gameweek", submitted: true },
      ],
    );

    expect([...submittedUsers]).toEqual(["complete"]);
  });

  it("does not treat an empty fixture list as a completed submission", () => {
    expect(usersWithCompleteGameweekSubmission([], [])).toEqual(new Set());
  });
});
