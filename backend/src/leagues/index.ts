import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { leagueCreateRateLimit, leagueJoinRateLimit, standingsReadRateLimit } from "../middleware/rate-limits.js";
import { createUserLeague, joinUserLeague, listUserLeagues, showLeagueMemberPredictions, showLeagueStandings } from "./leagues.controller.js";

export const leaguesRouter = Router();
leaguesRouter.get("/", authenticate, listUserLeagues);
leaguesRouter.post("/", authenticate, leagueCreateRateLimit, createUserLeague);
leaguesRouter.post("/join", authenticate, leagueJoinRateLimit, joinUserLeague);
leaguesRouter.get("/:leagueId/standings", authenticate, standingsReadRateLimit, showLeagueStandings);
leaguesRouter.get("/:leagueId/members/:memberUserId/predictions", authenticate, standingsReadRateLimit, showLeagueMemberPredictions);
