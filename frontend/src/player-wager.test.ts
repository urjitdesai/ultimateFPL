import { describe, expect, it } from "vitest";
import type { Wager } from "./api";
import { playerWagerResultLabel, playerWagerSelectionLabel, wagerNetPoints } from "./player-wager";

const wonWager: Wager = {
  id: "wager-1",
  fixtureId: "fixture-1",
  gameweekId: "gameweek-1",
  roundNumber: 1,
  selection: "HOME_WIN",
  stakePoints: 10,
  status: "WON",
  returnPoints: 20,
};

describe("league player wager details", () => {
  it("labels the wagered fixture and its net points", () => {
    const fixture = { homeTeam: { name: "Arsenal" }, awayTeam: { name: "Chelsea" } };
    expect(playerWagerSelectionLabel(wonWager, fixture)).toBe("Arsenal win");
    expect(wagerNetPoints(wonWager)).toBe(10);
    expect(playerWagerResultLabel(wonWager)).toBe("Wager won · +10 pts");
  });

  it("shows lost and pending wager outcomes", () => {
    expect(playerWagerResultLabel({ ...wonWager, status: "LOST", returnPoints: 0 })).toBe("Wager lost · -10 pts");
    expect(playerWagerResultLabel({ ...wonWager, status: "OPEN", returnPoints: null })).toBe("Wager result pending");
  });
});
