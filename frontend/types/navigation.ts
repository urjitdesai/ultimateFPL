export type RootStackParamList = {
  login: undefined;
  signup: undefined;
  main: undefined;
  LeagueDetails: {
    leagueId: string;
    leagueName: string;
  };
  UserPredictions: {
    userId: string;
    userName: string;
    initialGameweek?: number;
    joinedGameweek?: number;
  };
  UserPredictions2: {
    userId: string;
    userName: string;
    initialGameweek?: number;
  };
};

export type TabParamList = {
  Home: undefined;
  Leagues: undefined;
  Fixtures: undefined;
};
