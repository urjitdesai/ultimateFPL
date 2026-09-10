type StandingsMembershipState = {
  league: { memberCount: number };
  gameweeks: Array<{ id: string }>;
  selectedGameweek: { id: string } | null;
  standings: unknown[];
};

export function latestStandingsNeedMembershipSync(data: StandingsMembershipState) {
  const latestGameweek = data.gameweeks.at(-1);
  return Boolean(
    latestGameweek
      && data.selectedGameweek?.id === latestGameweek.id
      && data.league.memberCount !== data.standings.length,
  );
}
