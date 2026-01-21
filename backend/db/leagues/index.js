import express from "express";
import { leaguesController } from "./leagues.controller.js";
import { leagueScores2Controller } from "../leagueScores/leagueScores2.controller.js";
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

// Admin routes for creating default leagues
router.post(
  "/create-default-team-leagues",
  leaguesController.createDefaultTeamLeagues
);
router.post(
  "/create-gameweek-league",
  leaguesController.createDefaultGameweekLeague
);

// League scores routes (v2 - league-specific scores)
router.get(
  "/:leagueId/table",
  authenticateToken,
  leagueScores2Controller.getLeagueTable
);
router.get(
  "/:leagueId/gameweek/:gameweek",
  authenticateToken,
  leagueScores2Controller.getGameweekRankings
);
router.get(
  "/:leagueId/history/:userId",
  authenticateToken,
  leagueScores2Controller.getUserLeagueHistory
);

// Admin routes for score management
router.post(
  "/scores/update-gameweek",
  authenticateToken,
  leagueScores2Controller.updateLeagueScoresForGameweek
);
router.post(
  "/scores/backfill",
  // authenticateToken,
  leagueScores2Controller.backfillLeagueScores
);
router.post(
  "/scores/initialize",
  authenticateToken,
  leagueScores2Controller.initializeUserLeagueScore
);
router.delete(
  "/scores/delete-all",
  authenticateToken,
  leagueScores2Controller.deleteAllLeagueScores
);

// Legacy routes (keeping for backward compatibility)
router.post(
  "/:leagueId/calculate",
  authenticateToken,
  leagueScores2Controller.calculateLeagueScores
);
router.post(
  "/calculate-all",
  // authenticateToken,
  leagueScores2Controller.updateLeagueScoresForGameweek
);

// Public routes
router.get("/:id", leaguesController.getLeagueById);
router.get("/", leaguesController.getAllLeagues);

export default router;
