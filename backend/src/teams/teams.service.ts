export type Team = { id: string; name: string; shortName: string };

// Text-only identities are intentional until club-mark licensing is confirmed.
const teams: Team[] = [
  { id: "arsenal", name: "Arsenal", shortName: "ARS" },
  { id: "aston-villa", name: "Aston Villa", shortName: "AVL" },
  { id: "bournemouth", name: "Bournemouth", shortName: "BOU" },
  { id: "brentford", name: "Brentford", shortName: "BRE" },
  { id: "brighton", name: "Brighton & Hove Albion", shortName: "BHA" },
  { id: "burnley", name: "Burnley", shortName: "BUR" },
  { id: "chelsea", name: "Chelsea", shortName: "CHE" },
  { id: "crystal-palace", name: "Crystal Palace", shortName: "CRY" },
  { id: "everton", name: "Everton", shortName: "EVE" },
  { id: "fulham", name: "Fulham", shortName: "FUL" },
  { id: "leeds", name: "Leeds United", shortName: "LEE" },
  { id: "liverpool", name: "Liverpool", shortName: "LIV" },
  { id: "manchester-city", name: "Manchester City", shortName: "MCI" },
  { id: "manchester-united", name: "Manchester United", shortName: "MUN" },
  { id: "newcastle", name: "Newcastle United", shortName: "NEW" },
  { id: "nottingham-forest", name: "Nottingham Forest", shortName: "NFO" },
  { id: "sunderland", name: "Sunderland", shortName: "SUN" },
  { id: "tottenham", name: "Tottenham Hotspur", shortName: "TOT" },
  { id: "west-ham", name: "West Ham United", shortName: "WHU" },
  { id: "wolves", name: "Wolverhampton Wanderers", shortName: "WOL" }
];

export const getTeams = () => teams;
export const getTeamById = (id: string) => teams.find((team) => team.id === id);
