import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { listUserLeagues, showLeagueMemberPredictions, showLeagueStandings } from "./leagues.controller.js";

export const leaguesRouter = Router();
leaguesRouter.get("/", authenticate, listUserLeagues);
leaguesRouter.get("/:leagueId/standings", authenticate, showLeagueStandings);
leaguesRouter.get("/:leagueId/members/:memberUserId/predictions", authenticate, showLeagueMemberPredictions);
