import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { createUserLeague, joinUserLeague, listUserLeagues, showLeagueMemberPredictions, showLeagueStandings } from "./leagues.controller.js";
import { cancelLeagueWager, createLeagueWager, matchLeagueWager, showWagerBoard } from "../wagers/wagers.controller.js";

export const leaguesRouter = Router();
leaguesRouter.get("/", authenticate, listUserLeagues);
leaguesRouter.post("/", authenticate, createUserLeague);
leaguesRouter.post("/join", authenticate, joinUserLeague);
leaguesRouter.get("/:leagueId/wagers", authenticate, showWagerBoard);
leaguesRouter.post("/:leagueId/wagers", authenticate, createLeagueWager);
leaguesRouter.post("/:leagueId/wagers/:wagerId/match", authenticate, matchLeagueWager);
leaguesRouter.delete("/:leagueId/wagers/:wagerId", authenticate, cancelLeagueWager);
leaguesRouter.get("/:leagueId/standings", authenticate, showLeagueStandings);
leaguesRouter.get("/:leagueId/members/:memberUserId/predictions", authenticate, showLeagueMemberPredictions);
