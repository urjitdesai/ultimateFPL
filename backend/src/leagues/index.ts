import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { createUserLeague, joinUserLeague, listUserLeagues, showLeagueStandings } from "./leagues.controller.js";

export const leaguesRouter = Router();
leaguesRouter.get("/", authenticate, listUserLeagues);
leaguesRouter.post("/", authenticate, createUserLeague);
leaguesRouter.post("/join", authenticate, joinUserLeague);
leaguesRouter.get("/:leagueId/standings", authenticate, showLeagueStandings);
