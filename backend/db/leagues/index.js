import express from "express";
import { leaguesController } from "./leagues.controller.js";
const router = express.Router();

// GET /api/score/user/:userId/gameweek/:gameweek - get score for a specific user and gameweek
router.post("/create", leaguesController.createLeague);

// GET /api/score/user/:userId/total - get total score for a user across all gameweeks
router.post("/user-leagues", leaguesController.getUserLeagues);

router.post("/join", leaguesController.joinLeague);

router.get("/:id", leaguesController.getLeagueById);

router.get("/", leaguesController.getAllLeagues);

export default router;
