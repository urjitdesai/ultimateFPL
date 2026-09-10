import { describe, expect, it } from "vitest";
import { latestStandingsNeedMembershipSync } from "./league-standings-sync";

function standingsState({
  memberCount = 4,
  selectedGameweekId = "gw-2",
  rowCount = 3,
}: {
  memberCount?: number;
  selectedGameweekId?: string | null;
  rowCount?: number;
} = {}) {
  return {
    league: { memberCount },
    gameweeks: [{ id: "gw-1" }, { id: "gw-2" }],
    selectedGameweek: selectedGameweekId ? { id: selectedGameweekId } : null,
    standings: Array.from({ length: rowCount }),
  };
}

describe("league standings membership synchronization", () => {
  it("waits for the latest snapshot when the live member count and rows differ", () => {
    expect(latestStandingsNeedMembershipSync(standingsState())).toBe(true);
  });

  it("stops waiting once every current member has a row", () => {
    expect(latestStandingsNeedMembershipSync(standingsState({ rowCount: 4 }))).toBe(false);
  });

  it("does not wait on historical snapshots that predate a member", () => {
    expect(latestStandingsNeedMembershipSync(standingsState({ selectedGameweekId: "gw-1" }))).toBe(false);
  });
});
