import type { Wager } from "./api";

type FixtureTeams = {
  homeTeam: { name: string };
  awayTeam: { name: string };
};

export function wagerNetPoints(wager: Wager) {
  return Number(wager.returnPoints ?? 0) - wager.stakePoints;
}

export function playerGameweekPoints(predictionPoints: number, wager: Wager | null) {
  const wagerPoints = wager ? wagerNetPoints(wager) : 0;
  return { predictionPoints, wagerPoints, totalPoints: predictionPoints + wagerPoints };
}

export function playerWagerSelectionLabel(wager: Wager, fixture: FixtureTeams) {
  if (wager.selection === "HOME_WIN") return `${fixture.homeTeam.name} win`;
  if (wager.selection === "AWAY_WIN") return `${fixture.awayTeam.name} win`;
  return "Draw";
}

export function playerWagerResultLabel(wager: Wager) {
  if (wager.status === "OPEN") return "Wager result pending";
  const netPoints = wagerNetPoints(wager);
  return wager.status === "WON" ? `Wager won · +${netPoints} pts` : `Wager lost · ${netPoints} pts`;
}
