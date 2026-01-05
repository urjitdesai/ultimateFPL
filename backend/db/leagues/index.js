import express from "express";
import { leaguesController } from "./leagues.controller.js";
import { leagueScoresController } from "../leagueScores/leagueScores.controller.js";
import { authenticateToken } from "../../middleware/auth.js";

const router = express.Router();

// Protected routes that require authentication
router.post("/create", authenticateToken, leaguesController.createLeague);
router.post(
  "/user-leagues",
  authenticateToken,
  leaguesController.getUserLeagues
);
router.post("/join", authenticateToken, leaguesController.joinLeague);

// League scores routes
router.get(
  "/:leagueId/table",
  authenticateToken,
  leagueScoresController.getLeagueTable
);
router.get(
  "/:leagueId/gameweek/:gameweek",
  authenticateToken,
  leagueScoresController.getGameweekRankings
);
router.get(
  "/:leagueId/history/:userId",
  authenticateToken,
  leagueScoresController.getUserLeagueHistory
);
router.post(
  "/:leagueId/calculate",
  authenticateToken,
  leagueScoresController.calculateLeagueScores
);
router.post(
  "/calculate-all",
  // authenticateToken,
  leagueScoresController.calculateAllLeagueScores
);

// Public routes
router.get("/:id", leaguesController.getLeagueById);
router.get("/", leaguesController.getAllLeagues);

export default router;
